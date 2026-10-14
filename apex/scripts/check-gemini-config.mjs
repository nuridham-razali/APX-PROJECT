// Read model metadata only. Never generates text or tests speech.
import {brainConfig} from '../runtime/provider.mjs';
process.loadEnvFile('.env.local');
const brain=brainConfig();
if(brain.provider!=='gemini'||!brain.configured)throw new Error('Gemini is not configured.');
try{
 const list=process.argv.includes('--list');
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models${list?'?pageSize=1000':`/${brain.model}`}`,{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(15000)});
 if(!response.ok){console.log(JSON.stringify({provider:brain.provider,model:brain.model,status:response.status,metadataAvailable:false}));process.exitCode=1;}
 else{const data=await response.json();console.log(JSON.stringify(list?{models:(data.models||[]).filter(model=>model.supportedGenerationMethods?.includes('generateContent')&&model.name.includes('flash')).map(model=>({name:model.name,displayName:model.displayName})),more:Boolean(data.nextPageToken)}:{provider:brain.provider,model:brain.model,metadataAvailable:true,generateContent:data.supportedGenerationMethods?.includes('generateContent')===true}));}
}catch{console.log('Gemini model metadata could not be reached. No generation request was made.');process.exitCode=1;}
