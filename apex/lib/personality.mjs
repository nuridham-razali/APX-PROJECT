export const PERSONALITY_CONTROLS=Object.freeze([
 {key:'sarcasm',label:'SARCASM',color:'#efba49',styles:['Literal; minimal jokes.','Mostly literal, with rare dry humour.','Occasional dry humour.','Regular context-appropriate wit.','Frequent witty, context-appropriate sarcasm; use original humour, never movie dialogue.']},
 {key:'rough',label:'ROUGH',color:'#f57572',styles:['Gentle and tactful.','Frank but tactful.','Candid, slightly gruff.','Firm and plain-spoken.','Firm, blunt delivery without personal abuse.']},
 {key:'direct',label:'DIRECT',color:'#25dce9',styles:['Include context and explanation.','Explain the answer with useful context.','Answer first, then useful details.','Brief answer first; include necessary details.','Concise and decisive; retain essential information, uncertainty and caveats.']},
 {key:'warmth',label:'WARMTH',color:'#54dc9c',styles:['Neutral and professional.','Courteous and approachable.','Friendly and considerate.','Warm and reassuring.','Supportive, personable and encouraging.']},
 {key:'push',label:'PUSH',color:'#b89aff',styles:['Offer options and wait.','Offer one optional next step.','Suggest concrete next steps.','Encourage a specific next step and follow-through.','Actively challenge procrastination and encourage follow-through; respect no and requests to stop.']}
]);
export const PERSONALITY_PRESETS=Object.freeze({Default:[2,1,3,3,2],TARS:[5,2,4,2,3],Sergeant:[1,5,5,1,5],Retriever:[1,1,3,5,3],Board:[1,2,5,2,4]});
const keys=PERSONALITY_CONTROLS.map(c=>c.key);
export const PERSONALITY_SAMPLE='I keep putting off an important project. What should I do next?';
export function presetPersonality(name='Default',revision=0){
 if(!Object.hasOwn(PERSONALITY_PRESETS,name))throw new Error('Unknown personality preset.');
 return {version:1,levels:Object.fromEntries(keys.map((key,i)=>[key,PERSONALITY_PRESETS[name][i]])),preset:name,revision};
}
export function validatePersonality(value){
 if(!value||value.version!==1||!value.levels||typeof value.levels!=='object'||Array.isArray(value.levels))throw new Error('Invalid personality configuration.');
 if(Object.keys(value.levels).length!==keys.length||keys.some(k=>!Number.isInteger(value.levels[k])||value.levels[k]<1||value.levels[k]>5))throw new Error('Personality levels must be integers from 1 to 5.');
 if(value.preset!=='Custom'&&!Object.hasOwn(PERSONALITY_PRESETS,value.preset))throw new Error('Unknown personality preset.');
 if(!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('Invalid personality revision.');
 if(value.preset!=='Custom'&&keys.some((k,i)=>value.levels[k]!==PERSONALITY_PRESETS[value.preset][i]))throw new Error('Preset does not match its levels.');
 return {version:1,levels:Object.fromEntries(keys.map(k=>[k,value.levels[k]])),preset:value.preset,revision:value.revision};
}
export function changePersonality(current,action){
 const next=validatePersonality(current);
 if(!action||typeof action!=='object'||Array.isArray(action))throw new Error('Choose a personality setting or preset.');
 if(action.preset)return presetPersonality(action.preset,next.revision+1);
 if(!keys.includes(action.setting))throw new Error('Unknown personality setting.');
 const value=action.delta!==undefined?next.levels[action.setting]+action.delta:action.level;
 if(!Number.isSafeInteger(value)|| (action.delta!==undefined&&!Number.isSafeInteger(action.delta)))throw new Error('Use a whole-number personality level.');
 next.levels[action.setting]=Math.max(1,Math.min(5,value));next.preset='Custom';next.revision++;
 return next;
}
export function personalityInstruction(config,{internal=false}={}){
 const c=validatePersonality(config);
 const header=internal?'Communication profile is subordinate to this specialist role. Internal plans, tool arguments, calculations, citations and verification must remain neutral and precise. Apply style mainly to a final user-facing answer.':'User-facing communication profile:';
 return `${header}\n${PERSONALITY_CONTROLS.map(control=>`${control.label} ${c.levels[control.key]}/5: ${control.styles[c.levels[control.key]-1]}`).join(' ')}\nStyle never changes accuracy, confidence, permissions, confirmation requirements or tool capabilities. Never hide uncertainty or essential safety information. High Push grants no action authority. Respect refusal. Reduce jokes, sarcasm and roughness during distress or serious safety-sensitive conversations. Do not copy movie dialogue or change the selected voice.`;
}
const amount=value=>({zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,maximum:5,max:5,minimum:1,min:1}[value]??(/^\d{1,3}$/.test(value)?Number(value):null));
const alias={sarcasm:'sarcasm',rough:'rough',roughness:'rough',direct:'direct',directness:'direct',warmth:'warmth',push:'push',initiative:'push'};
export function parsePersonalityCommand(raw){
 // Only complete, unquoted top-level user utterances enter this parser.
 // Never call it on files, sources, retrieved text or generated answers.
 if(typeof raw!=='string'||raw.length>250||/[\n\r'"“”‘’`«»]/.test(raw))return null;
 const s=raw.trim().toLowerCase().replace(/^apex(?:\s*[,.:]\s*|\s+)/,'').replace(/^please\s+/,'').replace(/[.!?]+$/,'').trim();
 if(/^(?:what are|show|tell me|list) (?:your|my|the) personality settings$/.test(s))return {query:true};
 if(/^(?:reset|restore) (?:your|my|the) personality(?: settings)?$/.test(s))return {action:{preset:'Default'}};
 let m=s.match(/^(?:switch to|use|activate|set personality to) (default|tars|sergeant|retriever|board)(?: mode| personality| preset)?$/);
 if(m)return {action:{preset:Object.keys(PERSONALITY_PRESETS).find(k=>k.toLowerCase()===m[1])}};
 m=s.match(/^(?:set|change) (?:your |my |the )?(sarcasm|roughness|rough|directness|direct|warmth|push|initiative) (?:to|at) (\w+)$/);
 if(m&&amount(m[2])!==null)return {action:{setting:alias[m[1]],level:amount(m[2])}};
 m=s.match(/^(turn up|turn down|increase|raise|decrease|lower) (?:your |my |the )?(sarcasm|roughness|rough|directness|direct|warmth|push|initiative)(?: by (\w+)(?: levels?)?)?$/);
 if(m){const n=m[3]?amount(m[3]):1;if(n!==null&&n>0)return {action:{setting:alias[m[2]],delta:(['turn down','decrease','lower'].includes(m[1])?-1:1)*n}};}
 const relative={'be warmer':['warmth',1],'be less warm':['warmth',-1],'be more sarcastic':['sarcasm',1],'be less sarcastic':['sarcasm',-1],'be rougher':['rough',1],'be gentler':['rough',-1],'be more direct':['direct',1],'be less direct':['direct',-1],'push me more':['push',1],'push me less':['push',-1]};
 if(relative[s])return {action:{setting:relative[s][0],delta:relative[s][1]}};
 return null;
}
export function personalitySummary(c){return `${c.preset}: ${PERSONALITY_CONTROLS.map(x=>`${x.label.toLowerCase()} ${c.levels[x.key]}`).join(', ')} (levels 1–5).`;}
