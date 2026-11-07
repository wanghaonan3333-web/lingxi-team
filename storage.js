import {createHash, randomBytes} from 'node:crypto';
import {mkdir, open, rename, unlink, readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute, join, dirname} from 'node:path';

export function directory(config) {
  if (!isAbsolute(config.stateDirectory||'')) throw Error('OpenClaw 未提供插件私有状态目录。');
  const site=createHash('sha256').update(new URL(config.url).href).digest('hex');
  return join(config.stateDirectory,'lingxi-team','execution-v1',site);
}
export async function readJSON(path) {
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=await file.stat();
    if (!stat.isFile() || stat.mode&0o077 || stat.size>32*1024*1024) throw Error('插件私有文件权限或大小无效。');
    return JSON.parse(await file.readFile('utf8'));
  } finally {await file.close();}
}
export async function atomicJSON(path,value) {
  const temp=path+'.'+randomBytes(12).toString('hex')+'.tmp';
  const file=await open(temp,'wx',0o600);
  try {await file.writeFile(JSON.stringify(value));await file.sync();} finally {await file.close();}
  try {await rename(temp,path);} catch(e) {await unlink(temp).catch(()=>{});throw e;}
  const folder=await open(dirname(path),'r');
  try {await folder.sync();}finally{await folder.close();}
}
export async function ensure(config) {
  const root=directory(config);
  await mkdir(join(root,'connections'),{recursive:true,mode:0o700});
  await mkdir(join(root,'jobs'),{recursive:true,mode:0o700});
  return root;
}
export async function rememberConnection(config,context,route) {
  const root=await ensure(config);
  const id=createHash('sha256').update(JSON.stringify([new URL(config.url).href,route.agentId,route.accountId,route.senderId])).digest('hex');
  const target=route.groupId+(route.subareaId?'____'+route.subareaId:'');
  // Store trusted routing metadata only. No code, member secret or API Key.
  const saved={id,context:{agentId:route.agentId,accountId:route.accountId,requesterSenderId:route.senderId,
    channel:'octo',nativeChannelId:target,sessionKey:`agent:${route.agentId}:octo:group:${target}`},updatedAt:Date.now()};
  await atomicJSON(join(root,'connections',id+'.json'),saved);
  return id;
}
export async function connections(config) {
  const root=await ensure(config);
  const names=(await readdir(join(root,'connections'))).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).sort();
  const result=[];
  for(const name of names){const entry=await readJSON(join(root,'connections',name));if(entry.id+'.json'!==name)throw Error('连接记录无效。');result.push(entry);}
  return result;
}
export function jobPath(config,id) {
  if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('任务 ID 无效。');
  return join(directory(config),'jobs',id);
}
export async function lock(config) {
  const root=await ensure(config),path=join(root,'worker.lock');
  const value={pid:process.pid,nonce:randomBytes(16).toString('hex')};
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const file=await open(path,'wx',0o600);
      try {await file.writeFile(JSON.stringify(value));await file.sync();}finally{await file.close();}
      return async()=>{if((await readJSON(path)).nonce===value.nonce)await unlink(path);};
    } catch(e) {
      if(e.code!=='EEXIST')throw e;
      const owner=await readJSON(path);
      if(!Number.isSafeInteger(owner.pid)||owner.pid<=0)throw Error('执行锁需要管理员核验。');
      try {process.kill(owner.pid,0);throw Error('同一插件已有任务执行进程，不能重复启动。');}
      catch(alive) {if(alive.code!=='ESRCH')throw alive;}
      // Fail closed if another process replaced the stale lock meanwhile.
      if((await readJSON(path)).nonce!==owner.nonce)throw Error('执行锁已变化，请稍后重试。');
      await unlink(path);
    }
  }
  throw Error('无法获得任务执行锁。');
}
