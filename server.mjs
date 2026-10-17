import http from 'node:http';
import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {stageNatally} from './adapters/natally-promotion.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.VOCIFEROUS_PORT||5177),origin=`http://127.0.0.1:${port}`,token=randomBytes(32).toString('hex');
const argument=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1]};
const dataDir=path.resolve(argument('--data-dir')||path.join(process.env.LOCALAPPDATA||path.join(process.cwd(),'.local'),'VociferousClonerStudio'));
const natallyTarget=argument('--natally-repo');let writes=Promise.resolve();
export async function readBody(req,limit){const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('Request exceeds size limit');parts.push(chunk);}return Buffer.concat(parts);}
export function sendJSON(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
export function validId(value){return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);}
export async function handleAPI(req,res,url){
  if(req.headers['x-voice-studio-token']!==token || (req.method==='POST'&&req.headers.origin!==origin))return sendJSON(res,403,{error:'Local operator session required.'});
  if(url.pathname==='/api/bootstrap'&&req.method==='GET'){let commit='uncommitted';try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8',windowsHide:true}).trim())commit+='+dirty';}catch{}const packageJSON=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));const projects=(await readdir(path.join(dataDir,'projects'))).filter(x=>x.endsWith('.json'));return sendJSON(res,200,{creator:{appId:'mba.robin.vociferous-cloner-studio',name:'Vociferous Cloner Studio',url:'https://github.com/rebots-online/vociferous-cloner-studio',version:packageJSON.version,commit},privateStorage:dataDir,projects:projects.map(p=>p.slice(0,-5)),natallyEnabled:!!natallyTarget});}
  if(url.pathname==='/api/project'&&req.method==='POST'){const data=JSON.parse((await readBody(req,5_000_000)).toString());if(data.schema!=='vociferous.project/v1'||!validId(data.id)||!Array.isArray(data.events)||!Array.isArray(data.order)||!Array.isArray(data.disabled)||typeof data.name!=='string'||data.name.length>200||data.events.length>10000)throw Error('Invalid project document');const dest=path.join(dataDir,'projects',data.id+'.json'),temp=dest+'.'+randomUUID();await writeFile(temp,JSON.stringify(data));await rename(temp,dest);return sendJSON(res,200,{saved:data.id});}
  const project=/^\/api\/project\/([a-f0-9-]+)$/i.exec(url.pathname);if(project&&req.method==='GET'&&validId(project[1])){return sendJSON(res,200,JSON.parse(await readFile(path.join(dataDir,'projects',project[1]+'.json'),'utf8')));}
  const sample=/^\/api\/sample\/([a-f0-9-]+)$/i.exec(url.pathname);if(sample&&validId(sample[1])){const dest=path.join(dataDir,'samples',sample[1]);if(req.method==='POST'){const bytes=await readBody(req,50_000_000);if(!bytes.length)throw Error('Empty source');await writeFile(dest,bytes,{flag:'wx'});return sendJSON(res,200,{id:sample[1],bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}if(req.method==='GET'){const bytes=await readFile(dest);res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'});return res.end(bytes);}}
  if(url.pathname==='/api/stage-natally'&&req.method==='POST'){const data=JSON.parse((await readBody(req,2_000_000)).toString());if(typeof data.wav!=='string'||data.wav.length>650000)throw Error('Invalid reference payload');return sendJSON(res,200,await stageNatally(Buffer.from(data.wav,'base64'),data.manifest,natallyTarget,path.join(dataDir,'rollbacks')));}
  return sendJSON(res,404,{error:'Unknown local operator operation'});
}
export async function start(){
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid loopback port');await mkdir(path.join(dataDir,'samples'),{recursive:true});await mkdir(path.join(dataDir,'projects'),{recursive:true});
  const vite=await createServer({root,configFile:path.join(root,'vite.config.ts'),server:{middlewareMode:true,host:'127.0.0.1',hmr:false,cors:false,allowedHosts:['127.0.0.1','localhost']}});
  await writeFile(path.join(dataDir,'session.json'),JSON.stringify({url:origin+'/#session='+token,origin},null,2),{mode:0o600});
  const server=http.createServer((req,res)=>{if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==origin){return sendJSON(res,403,{error:'Loopback same-origin access only'});}const url=new URL(req.url,origin);if(url.pathname.startsWith('/api/')){const operation=()=>handleAPI(req,res,url).catch(error=>sendJSON(res,error.code==='ENOENT'?404:400,{error:error.message}));if(req.method==='POST'){writes=writes.then(operation,operation);}else void operation();return;}vite.middlewares(req,res);});
  server.listen(port,'127.0.0.1',()=>{console.log(`Vociferous Cloner Studio: ${origin}\nPrivate launch URL is in: ${path.join(dataDir,'session.json')}\nPrivate data: ${dataDir}\nNatally adapter: ${natallyTarget?'enabled (staging only)':'disabled'}\nOnly the local operator editor is served. No automatic publication.`);});
  const close=()=>{server.close();void vite.close();};process.on('SIGINT',close);process.on('SIGTERM',close);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))start().catch(error=>{console.error(error.message);process.exitCode=1;});
