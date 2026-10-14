import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
export async function windowsAction(action,input={}, {signal,runner=execFile,platform=process.platform}={}){
 if(platform!=='win32')throw new Error('Windows desktop control is unavailable on this host.');
 // Run only our fixed local script; this process flag does not change the machine's execution policy.
 const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./windows-tools.ps1',import.meta.url)),'-Action',action];
 if(input.operation)args.push('-Operation',input.operation);
 if(input.windowId)args.push('-WindowId',String(input.windowId));
 if(input.value!==undefined)args.push('-Value',String(input.value));
 if(input.outputPath)args.push('-OutputPath',input.outputPath);
 return new Promise((yes,no)=>runner('powershell.exe',args,{windowsHide:true,shell:false,timeout:15000,maxBuffer:100000,signal},(error,stdout)=>{if(error)return no(new Error(`Windows ${action} failed or is unavailable on this device.`));try{yes(JSON.parse(stdout));}catch{no(new Error('Windows returned no readable execution receipt.'));}}));
}
export async function screenshot(env,signal){const dir=resolve(env.APEX_DATA_DIR||'.apex-data','screenshots');await mkdir(dir,{recursive:true});return windowsAction('screenshot',{outputPath:join(dir,randomUUID()+'.png')},{signal});}
