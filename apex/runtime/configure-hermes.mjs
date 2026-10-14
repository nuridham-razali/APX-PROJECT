import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {brainConfig} from './provider.mjs';
try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const brain=brainConfig(process.env);
if(brain.provider!=='ollama')throw new Error('This configuration helper only enables the guarded local model.');
const context=Number(process.env.APEX_HERMES_CONTEXT_LENGTH||8192);
const metadata=await (await fetch(brain.base+'/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:brain.model}),signal:AbortSignal.timeout(8000)})).json();
const supported=Object.entries(metadata.model_info||{}).find(([key])=>key.endsWith('.context_length'))?.[1];
if(!Number.isInteger(context)||context<64000||typeof supported!=='number'||supported<context)throw new Error('No settings changed: select an installed compatible local model and explicitly set APEX_HERMES_CONTEXT_LENGTH to at least 64000 before enabling Hermes.');
const root=resolve('.apex-data/hermes-home');mkdirSync(root,{recursive:true});
const secretFile=join(root,'.apex-api-key');
if(!existsSync(secretFile))writeFileSync(secretFile,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
const apiKey=readFileSync(secretFile,'utf8').trim(),modelKey=readFileSync(resolve(process.env.APEX_DATA_DIR||'.apex-data','hermes-model-token'),'utf8').trim();
// Only this dedicated APEX home is configured. Preserve any previous generated
// config for review; never read or modify a user's other Hermes profile.
const configPath=join(root,'config.yaml');if(existsSync(configPath))writeFileSync(configPath+'.previous',readFileSync(configPath),{mode:0o600});
const modelUrl=`http://127.0.0.1:${Number(process.env.APEX_RUNTIME_PORT||8081)}/hermes/model/v1`;
writeFileSync(configPath,`model:\n  provider: custom\n  default: ${JSON.stringify(brain.model)}\n  base_url: ${JSON.stringify(modelUrl)}\n  context_length: ${context}\nfallback_providers: []\nplatform_toolsets:\n  api_server: [web, no_mcp]\n  cli: []\nagent:\n  max_turns: 6\n  run_budget_seconds: 170\ncompression:\n  enabled: false\nweb:\n  search_backend: ddgs\n  extract_backend: exa\nauxiliary:\n  background_review:\n    enabled: false\n  title_generation:\n    enabled: false\n    model_upgrade_enabled: false\nmcp_servers: {}\n`,{mode:0o600});
writeFileSync(join(root,'.env'),`API_SERVER_ENABLED=true\nAPI_SERVER_HOST=127.0.0.1\nAPI_SERVER_PORT=8642\nAPI_SERVER_KEY=${apiKey}\nOPENAI_BASE_URL=${modelUrl}\nOPENAI_API_KEY=${modelKey}\n`,{mode:0o600});
if(process.argv.includes('--validation')){console.log('Hermes validation profile configured; production APEX settings unchanged.');process.exit(0);}
const apexEnvPath=resolve('.env.local');let content=existsSync(apexEnvPath)?readFileSync(apexEnvPath,'utf8'):'';
for(const [key,value] of Object.entries({APEX_ORCHESTRATOR:'hermes',APEX_HERMES_URL:'http://127.0.0.1:8642',APEX_HERMES_API_KEY:apiKey,APEX_HERMES_TIMEOUT_MS:'180000',APEX_HERMES_DAILY_CALL_LIMIT:'100'})){
  const pattern=new RegExp(`^${key}=.*$`,'gm');content=pattern.test(content)?content.replace(pattern,`${key}=${value}`):content.trimEnd()+`\n${key}=${value}\n`;
}
writeFileSync(apexEnvPath,content,{mode:0o600});
console.log('Configured the dedicated Hermes home and APEX adapter. Private keys were saved without displaying them. Restart APEX runtime and start the dedicated Hermes gateway.');
