import {rememberConnection} from './storage.js';
import {createHash, createHmac, randomBytes} from 'node:crypto';
import {open, mkdir, link, unlink, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute, join} from 'node:path';

function privateIdentity(context) {
  const session = context.sessionKey?.toLowerCase();
  const sender = (context.requesterSenderId || context.senderId || '').trim().toLowerCase();
  const agent = context.agentId?.toLowerCase();
  const channel = (context.channelId || context.messageChannel || context.channel || '').toLowerCase();
  if (!sender || !agent || !channel || !session) throw Error('请使用按发送者隔离的私聊。');
  // Accept only an exact direct-peer route; shared main sessions, groups, threads,
  // delegated sessions and model-supplied identity arguments are never used.
  const parts = session.split(':');
  const prefixMatches = parts[0] === 'agent' && parts[1] === agent && parts[2] === channel;
  const accountScoped = parts.length === 6 && parts[3] && parts[4] === 'direct';
  if (!prefixMatches || !accountScoped || parts[5] !== sender) {
    throw Error('请使用独立私聊，并由管理员设置 session.dmScope 为 per-account-channel-peer。');
  }
  // Keep the same chat identity across host credential rotations.
  return createHash('sha256').update(JSON.stringify(['lingxi-team-v1', session, sender])).digest('hex');
}

function octoMember(context) {
  const channel = context.channelId || context.messageChannel || context.channel;
  if (channel !== 'octo') throw Error('个人成员接入目前支持 Octo，请在实际聊天中 @助手。');
  const agentId = context.agentId;
  const accountId = context.accountId || context.agentAccountId;
  const senderId = context.requesterSenderId || context.senderId;
  const valid = value => typeof value==='string' && /^[A-Za-z0-9_.-]{1,160}$/.test(value);
  if (![agentId,accountId,senderId].every(valid)) throw Error('渠道缺少可信机器人账号、Agent 或当前发送者，请管理员升级渠道。');
  const destinations = [context.nativeChannelId,context.to,context.deliveryContext?.to].filter(x=>x!=null);
  const normalize = value => {
    if (typeof value!=='string') throw Error('聊天目的地无效。');
    return value.replace(/^octo:/,'').replace(/^(?:group|channel):/,'');
  };
  if (!destinations.length) throw Error('渠道未传递可信聊天目的地，已停止操作。');
  const target = normalize(destinations[0]);
  if (destinations.some(x=>normalize(x)!==target)) throw Error('聊天目的地不一致，不能回退到主群。');
  const session = (context.sessionKey||'').toLowerCase();
  let groupId='', subareaId='';
  const pieces = target.split('____');
  if (pieces.length>2 || !pieces.every(valid)) throw Error('群或子区身份无效。');
  [groupId,subareaId=''] = pieces;
  if (session!==`agent:${agentId}:octo:group:${target}`.toLowerCase()) throw Error('请在真实 Octo 群或子区接入；不能使用网页或共享 main 会话。');
  if (context.threadParentId!=null && normalize(context.threadParentId)!==groupId) throw Error('子区父群不一致。');
  const thread = context.messageThreadId ?? context.deliveryContext?.threadId;
  if (thread!=null && String(thread)!==subareaId && String(thread)!==target) throw Error('子区身份不一致。');
  return {channel:'octo',agentId,accountId,senderId,groupId,subareaId};
}

async function installationKey(directory) {
  if (!directory || !isAbsolute(directory)) throw Error('请升级 OpenClaw 以使用独立私聊绑定。');
  const folder = join(directory, 'lingxi-team');
  await mkdir(folder, {recursive:true, mode:0o700});
  const path = join(folder, 'installation.key');
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const temporary = join(folder, randomBytes(16).toString('hex') + '.tmp');
    await writeFile(temporary, randomBytes(32), {flag:'wx', mode:0o600});
    try {
      await link(temporary, path);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    } finally { await unlink(temporary); }
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size !== 32 || (stat.mode & 0o077)) throw Error('请检查灵犀插件本机密钥和文件权限。');
    return await file.readFile();
  } finally { await file.close(); }
}

export async function request(config, context, action, parameters = {}, personal = false) {
  if (!config.url || (config.hostKeyFile && !isAbsolute(config.hostKeyFile))) throw Error('请管理员先配置灵犀插件。');
  if (config.agentId && context.agentId !== config.agentId) throw Error('请使用管理员指定的灵犀助手。');
  const conversation = personal ? octoMember(context) : null;
  if (personal && config.hostKeyFile) throw Error('个人接入须使用插件本机身份，不支持共享主机密钥模式。');
  const identity = personal ? undefined : privateIdentity(context);
  const base = new URL(config.url);
  const loopback = ['127.0.0.1','localhost','[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(loopback && base.protocol === 'http:')) ||
      base.username || base.password || base.search || base.hash) throw Error('灵犀站点配置无效。');
  let authorization;
  if (config.hostKeyFile) {
    const file = await open(config.hostKeyFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    let key;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.mode & 0o077) throw Error('请管理员检查主机密钥文件权限。');
      key = (await file.readFile('utf8')).trim();
    } finally { await file.close(); }
    if (key.length < 32) throw Error('请管理员检查主机密钥。');
    authorization = 'Bearer ' + key;
  } else {
    const key = await installationKey(config.stateDirectory);
    if (conversation) {
      conversation.agentFingerprint = createHmac('sha256',key).update(JSON.stringify(['lingxi-agent-v1',base.href,conversation.agentId])).digest('hex');
      const memberSecret = createHmac('sha256',key).update(JSON.stringify(['lingxi-member-v1',base.href,conversation.agentId,conversation.accountId,conversation.senderId])).digest('hex');
      authorization = 'Lingxi-Member '+memberSecret;
    } else {
      const chatSecret = createHmac('sha256', key).update(JSON.stringify([base.href, identity])).digest('hex');
      authorization = 'Lingxi-Chat ' + chatSecret;
    }
  }
  if (personal && ['redeem','projects','project','tasks','enqueue'].includes(action)) {
    await rememberConnection(config,context,conversation);
  }
  context.assertInvocationCurrent?.();
  const url = config.url.replace(/\/+$/,'') + '/api/chat-host/' + action;
  const response = await fetch(url, {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/json',Authorization:authorization},
    body:JSON.stringify({...parameters,identity,...(conversation?{conversation}:{})}),
  });
  if (!response.ok) {
    const error = await response.json().catch(()=>({}));
    const failure=Error(error.error || '灵犀连接失败，请检查绑定状态。');
    failure.status=response.status;throw failure;
  }
  const result = await response.json();
  context.assertInvocationCurrent?.();
  return result;
}

export async function readForCaller(config,context,action,parameters={}) {
  const channel=context.channelId||context.messageChannel||context.channel;
  // Preserve the legacy private-chat identity. Groups and subareas always use
  // the current sender's identity; never fall back to another member or group grant.
  if(channel==='octo' && context.sessionKey?.includes(':group:'))return request(config,context,action,parameters,true);
  return request(config,context,action,parameters);
}

