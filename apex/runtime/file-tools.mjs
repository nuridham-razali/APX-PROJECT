import {resolve,relative,isAbsolute,dirname,join} from 'node:path';
import {realpath,readFile,writeFile,rename,copyFile,mkdir,stat,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {projectFile,projectList} from './node-tools.mjs';
const protectedPath=/(^|[\\/])(?:\.env[^\\/]*|\.apex-data|\.git|\.next|\.aws|\.codex|\.vercel|.voice-env|node_modules|secrets?|credentials?)([\\/]|$)|(?:\.sqlite|\.pem|\.key|runtime-token)$/i;
const hash=text=>createHash('sha256').update(text).digest('hex');
async function target(root,path){
 if(typeof path!=='string'||!path||isAbsolute(path)||path.includes('\0')||protectedPath.test(path))throw new Error('Path is outside authorised project files.');
 const base=await realpath(root),destination=resolve(base,path),parent=await realpath(dirname(destination));
 if(relative(base,parent).startsWith('..')||isAbsolute(relative(base,parent))||protectedPath.test(relative(base,parent)))throw new Error('Path escapes the authorised root.');
 try{await realpath(destination);await projectFile(root,path);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!/\.(?:md|txt|json|css|tsx?|jsx?|mjs|cjs|py|html)$/i.test(path))throw new Error('Only authorised text files are supported.');
 return destination;
}
export async function fileAction(engine,action,input,context){
 const root=resolve(engine.env.APEX_PROJECT_ROOT||process.cwd());
 if(action==='list')return {root:'Authorised project',files:await projectList(root)};
 if(action==='read')return projectFile(root,input.path);
 const source=await target(root,input.path),before=await readFile(source,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(before!==null&&Buffer.byteLength(before)>200000)throw new Error('File exceeds the 200 KB text limit.');
 const record={action,path:input.path,before,conversationId:context.conversationId,state:'available'};
 if(action==='write'){if(input.text.length>200000)throw new Error('Text exceeds the file limit.');await writeFile(source,input.text,{flag:before===null?'wx':'w'});record.afterHash=hash(input.text);}
 else if(action==='copy'||action==='rename'){
  if(before===null)throw new Error('Source file does not exist.');const destination=await target(root,input.destination);
  try{await stat(destination);throw new Error('Destination already exists; no file was overwritten.');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(action==='copy')await copyFile(source,destination,1);else await rename(source,destination);
  record.destination=input.destination;record.afterHash=hash(before);
 }else if(action==='delete'){
  if(before===null)throw new Error('Source file does not exist.');const trash=resolve(engine.env.APEX_DATA_DIR||'.apex-data','trash');await mkdir(trash,{recursive:true});record.trash=join(trash,randomUUID()+'.txt');await rename(source,record.trash);record.afterHash=hash(before);
 }else throw new Error('Unsupported file action.');
 const saved=engine.store.create('action_journal',record);return {action,path:input.path,destination:input.destination,completed:true,undoId:saved.id,recoverable:true};
}
export async function undoFile(engine,id,context){
 const record=engine.store.get('action_journal',id);if(!record||record.state!=='available'||record.conversationId!==context.conversationId)throw new Error('No matching undo action in this conversation.');
 const root=resolve(engine.env.APEX_PROJECT_ROOT||process.cwd()),source=await target(root,record.path);
 if(record.action==='write'){
  const current=await readFile(source,'utf8');if(hash(current)!==record.afterHash)throw new Error('File changed since this action; undo would overwrite newer work.');
  if(record.before===null)await unlink(source);else await writeFile(source,record.before);
 }else if(record.action==='copy'||record.action==='rename'){
  const destination=await target(root,record.destination);if(hash(await readFile(destination,'utf8'))!==record.afterHash)throw new Error('Destination changed; undo refused.');
  if(record.action==='copy')await unlink(destination);else{try{await stat(source);throw new Error('Original path is occupied; undo refused.');}catch(e){if(e.code!=='ENOENT')throw e;}await rename(destination,source);}
 }else if(record.action==='delete'){
  try{await stat(source);throw new Error('Original path is occupied; undo refused.');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(hash(await readFile(record.trash,'utf8'))!==record.afterHash)throw new Error('Recovery copy changed; undo refused.');await rename(record.trash,source);
 }else throw new Error('No supported reversal exists.');
 engine.store.put('action_journal',{...record,state:'undone',undoneAt:new Date().toISOString()});return {undone:true,id,path:record.path};
}
