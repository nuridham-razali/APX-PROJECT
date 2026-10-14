// Import reviewed visual/synthesis code from the user's local reference.
// The embedded renderer stays isolated from the assistant's backend and keys.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const sourcePath=process.argv[2];
if(!sourcePath)throw new Error('Pass the original HTML path.');
const source=readFileSync(sourcePath,'utf8');
const entry=source.indexOf('/* Production entry:');
if(entry<0)throw new Error('Expected original renderer entry not found.');
const bridge=`
/* APEX host bridge: no independent microphone, camera, fullscreen or speech. */
bE(false);
function ApexHostedEntity(){
 const [state,setState]=Ne.useState('idle'),[revision,setRevision]=Ne.useState(0);
 const audioState=Ne.useRef('off');
 const assemblySoundStarted=Ne.useRef(false);
 Ne.useEffect(()=>{
  const receive=event=>{
   if(event.source!==parent||event.data?.channel!=='apex-humanoid-v1')return;
   const msg=event.data;
   if(msg.type==='signal'){
    if(['idle','listening','thinking','speaking'].includes(msg.phase))setState(msg.phase);
    UE('input',Math.max(0,Math.min(1,Number(msg.inputLevel)||0)));
    UE('output',Math.max(0,Math.min(1,Number(msg.outputLevel)||0)));
    window.__APEX_MOTION=msg.motion!==false;
    document.documentElement.dataset.apexMotion=msg.motion===false?'paused':'running';
    document.documentElement.style.setProperty('--apex-animation-play',msg.motion===false?'paused':'running');
   }
   if(msg.type==='replay')setRevision(n=>n+1);
   if(msg.type==='audio'){
    if(msg.enabled&&(!rt||rt.state!=='running')){QU();rt?.resume().catch(()=>{});}
    bE(!!msg.enabled);
    if(Lm&&rt)Lm.gain.setTargetAtTime(msg.enabled?NU*.62*Math.max(0,Math.min(1,Number(msg.volume)||0))*(msg.speaking?.2:1):0,rt.currentTime,.04);
    const status=msg.enabled?(rt?.state||'unavailable'):'off';
    // Start the original complete assembly only after its context is running.
    if(msg.enabled&&status==='running'&&!assemblySoundStarted.current){assemblySoundStarted.current=true;setRevision(n=>n+1);}
    document.documentElement.dataset.apexAudio=status;
    if(status!==audioState.current){audioState.current=status;parent.postMessage({channel:'apex-humanoid-v1',type:'audio-status',state:status},'*');}
   }
  };
  window.addEventListener('message',receive);
  parent.postMessage({channel:'apex-humanoid-v1',type:'ready'},'*');
  return()=>{window.removeEventListener('message',receive);jv.forEach(n=>{try{n.stop()}catch{}});rt?.close().catch(()=>{});};
 },[]);
 return Tt.jsx(UU,{state,onExit:()=>{},key:revision});
}
EE.createRoot(document.getElementById('root')).render(Tt.jsx(ApexHostedEntity,{}));
</script></body></html>`;
let hosted=source.slice(0,entry)+bridge;
// Prevent legacy renderer button handlers from requesting new devices.
hosted=hosted.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; media-src 'none'; font-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'">`);
hosted=hosted.replace('</style>',`button[aria-label="Open hand gesture"],button[aria-label="Open camera now"],button[aria-label="Close camera"],button[aria-label="Exit humanoid view"]{display:none!important}</style>`);
hosted=hosted.replace('<script>',`<script>
// Gate drawing while the host animation switch is paused, preserving callbacks.
const apexNativeFrame=window.requestAnimationFrame.bind(window),apexNativeCancel=window.cancelAnimationFrame.bind(window),apexFrameJobs=new Map();
let apexFrameId=0;
window.requestAnimationFrame=callback=>{
 const id=++apexFrameId;
 const draw=time=>{if(!apexFrameJobs.has(id))return;if(window.__APEX_MOTION===false){apexFrameJobs.set(id,apexNativeFrame(draw));return;}apexFrameJobs.delete(id);document.documentElement.dataset.apexFrames=String(Number(document.documentElement.dataset.apexFrames||0)+1);callback(time);};
 apexFrameJobs.set(id,apexNativeFrame(draw));return id;
};
window.cancelAnimationFrame=id=>{apexNativeCancel(apexFrameJobs.get(id));apexFrameJobs.delete(id);};
`);
hosted=hosted.replace('</style>','*{animation-play-state:var(--apex-animation-play,running)!important}</style>');
mkdirSync('public/humanoid',{recursive:true});writeFileSync('public/humanoid/apex-entity.html',hosted);

const start=source.indexOf('const DU =');
const end=source.indexOf('function FU(',start);
const hornStart=source.indexOf('  , GU =',end);
const hornEnd=source.indexOf('function XU(',hornStart);
if([start,end,hornStart,hornEnd].some(n=>n<0))throw new Error('Original horn helpers not found.');
let helpers=source.slice(start,end);
helpers=helpers.replace('rt = new (window.AudioContext || window.webkitAudioContext)', 'rt = context');
helpers=helpers.replace('Lm.connect(rt.destination)','Lm.connect(destination)');
const horns='const GU ='+source.slice(hornStart+'  , GU ='.length,hornEnd);
writeFileSync('lib/original-horn.mjs',`// Original Tripod synthesis from the user-provided APEX-Animated-Entity HTML.
// Oscillators, formants, compressor, convolution and timing are preserved.
// Only the context/output are injected to retain HUD volume, mute and speech ducking.
export function createOriginalHorn(context,destination){
${helpers}
${horns}
 f_();
 return {
  play(start=context.currentTime){GU[0].play(3.2,start);WU(2.6,start+3.2*.72);},
  stop(){for(const node of [...jv]){try{node.stop()}catch{}}jv=[];Lm.disconnect();}
 };
}
`);
console.log('Imported isolated humanoid renderer and original Tripod horn helpers.');
