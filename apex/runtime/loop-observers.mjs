import {readdir,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {createHash} from 'node:crypto';
import {freemem,totalmem} from 'node:os';
import {projectFile} from './node-tools.mjs';
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const ignored=/^(?:\.env.*|\.apex-data|\.git|node_modules|\.next|\.voice-env|secrets?|credentials?)$/i;
export async function projectSnapshot(root,folder='',signal){const base=await realpath(root),target=await realpath(resolve(base,folder)),rel=relative(base,target);if(rel.startsWith('..')||isAbsolute(rel)||(await stat(target)).isDirectory()===false)throw new Error('Watch folder must be inside the authorised project root.');const files={};let truncated=false,count=0;
 async function walk(dir,depth){signal?.throwIfAborted();if(depth>6){truncated=true;return;}for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.isSymbolicLink()||ignored.test(entry.name))continue;if(count>=500){truncated=true;return;}const path=join(dir,entry.name);if(entry.isDirectory())await walk(path,depth+1);else if(/\.(tsx?|jsx?|mjs|cjs|json|css|md|txt|py|html)$/i.test(entry.name)){try{const source=await projectFile(base,relative(base,path));files[source.path]=digest(source.text);count++;}catch{}}}}
 await walk(target,0);return {files,fingerprint:digest(files),coverage:'At most 500 authorised text files, depth 6, 200 KB each; protected paths, symlinks and unsupported files excluded.',truncated};}
export function changedFiles(before,after){return [...new Set([...Object.keys(before||{}),...Object.keys(after||{})])].filter(path=>before?.[path]!==after?.[path]).map(path=>({path,deleted:!Object.hasOwn(after,path)}));}
export function ramObservation(percent){const usedPercent=(1-freemem()/totalmem())*100;return {metric:'RAM used percentage',usedPercent:Math.round(usedPercent*10)/10,threshold:percent,matched:usedPercent>=percent};}
