// One command implementation shared by the native CLI and caller-bound chat tools.
// CLI is an operator surface on the trusted host. Chat tools NEVER accept a
// connection/user ID from model arguments; identity comes from OpenClaw context.
import {request,readForCaller} from './auth.js';
import {connections,jobPath,readJSON,atomicJSON} from './storage.js';
import {localStatus} from './worker.js';
import {join} from 'node:path';

export async function executeForCaller(config,context,args) {
  if(args.action==='projects')return readForCaller(config,context,'projects');
  if(args.action==='project')return readForCaller(config,context,'project',
    {projectId:args.projectId,episode:args.episode,offset:args.offset});
  if(args.action==='tasks')return request(config,context,'tasks',{},true);
  if(['analyze','prompts'].includes(args.action))return request(config,context,'enqueue',
    {projectId:args.projectId,kind:args.action==='analyze'?'breakdown':'episode-prompts',
     revision:args.revision,episodeNumber:args.episode},true);
  throw Error('不支持的灵犀操作。');
}

export function registerCLI(api,getConfig) {
  api.registerCli?.(({program})=>{
    const root=program.command('lingxi').description('灵犀项目与任务 CLI（本机操作员入口）');
    const print=value=>console.log(JSON.stringify(value,null,2));
    root.command('status').description('查看插件自动执行服务与本机任务状态').action(async()=>print(await localStatus(getConfig())));
    const context=async id=>{
      const rows=await connections(getConfig()),row=rows.find(r=>r.id===id);
      if(!row)throw Error('连接不存在。使用 lingxi status 查看本机连接；不能自动借用其他成员。');
      return row.context;
    };
    root.command('projects').requiredOption('--connection <id>','明确指定本机已绑定连接').action(async o=>print(await executeForCaller(getConfig(),await context(o.connection),{action:'projects'})));
    root.command('project').requiredOption('--connection <id>').requiredOption('--project <id>').option('--episode <number>').option('--offset <number>').action(async o=>print(await executeForCaller(getConfig(),await context(o.connection),{action:'project',projectId:o.project,episode:o.episode===undefined?undefined:Number(o.episode),offset:o.offset===undefined?undefined:Number(o.offset)})));
    root.command('tasks').requiredOption('--connection <id>').action(async o=>print(await executeForCaller(getConfig(),await context(o.connection),{action:'tasks'})));
    root.command('analyze').requiredOption('--connection <id>').requiredOption('--project <id>').requiredOption('--revision <number>').action(async o=>print(await executeForCaller(getConfig(),await context(o.connection),{action:'analyze',projectId:o.project,revision:Number(o.revision)})));
    root.command('prompts').requiredOption('--connection <id>').requiredOption('--project <id>').requiredOption('--episode <number>').action(async o=>print(await executeForCaller(getConfig(),await context(o.connection),{action:'prompts',projectId:o.project,episode:Number(o.episode)})));
    root.command('task <id>').description('读取本机已领取任务的不可变输入（仅本机操作员）').action(async id=>{
      const record=await readJSON(join(jobPath(getConfig(),id),'journal.json'));
      print({jobId:id,phase:record.phase,input:record.claim.payload.request});
    });
    root.command('submit <id>').description('核验原会话后补交已有结果，不重新调用模型')
      .requiredOption('--connection <id>').requiredOption('--file <path>','0600 JSON 结果文件')
      .requiredOption('--reconciled','已核验结果来自该任务原会话')
      .action(async(id,o)=>{
        const config=getConfig(),folder=jobPath(config,id),record=await readJSON(join(folder,'journal.json'));
        if(record.connectionId!==o.connection||!['needs_attention','dispatch_uncertain'].includes(record.phase))throw Error('只能补交当前连接下已经停留待核验的任务；不能覆盖正在处理的任务。');
        const result=await readJSON(o.file),output={result};
        await atomicJSON(join(folder,'manual-output.json'),output);
        const claim=record.claim,lease=Object.fromEntries(['jobId','generation','claimToken','inputHash'].map(k=>[k,claim[k]]));
        await request(config,await context(o.connection),'worker-resume',{payload:lease},true);
        print(await request(config,await context(o.connection),'worker-complete',{payload:{...lease,output}},true));
      });
  },{descriptors:[{name:'lingxi',description:'灵犀项目与任务 CLI（本机操作员入口）',hasSubcommands:true}]});
}
