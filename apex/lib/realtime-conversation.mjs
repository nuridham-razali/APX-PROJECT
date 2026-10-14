import {jsonLines} from './json-stream.mjs';

/** @param {object} body @param {{signal?: AbortSignal, onText?: (delta: string, text: string) => void, fetcher?: typeof fetch}} options */
export async function streamConversation(body,{signal,onText=(delta,text)=>{},fetcher=fetch}={}){
 const response=await fetcher('/api/runtime/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Conversation request failed.');}
 let text='',reply=null;
 for await(const event of jsonLines(response.body,signal)){
  signal?.throwIfAborted();
  if(event.type==='error')throw new Error(event.error||'Conversation failed.');
  if(event.type==='delta'&&typeof event.text==='string'){text+=event.text;onText(event.text,text);}
  if(event.type==='done'){
   if(typeof event.reply?.message!=='string')throw new Error('Conversation returned an invalid reply.');
   reply=event.reply;if(!text)onText(reply.message,reply.message);break;
  }
 }
 if(!reply)throw new Error('Connection ended before the reply completed.');
 return reply;
}

// Bounded sentence chunks start speech before a long answer has finished generating.
export class SentenceBuffer {
 constructor(emit,{maxChars=1500,maxSegments=8,chunkSize=280}={}){Object.assign(this,{emit,maxChars,maxSegments,chunkSize});this.buffer='';this.used=0;this.segments=0;}
 push(delta){this.buffer+=delta;this.drain(false);}
 finish(){this.drain(true);}
 drain(final){
  while(this.buffer.length){
   if(this.used>=this.maxChars||this.segments>=this.maxSegments){this.buffer='';return;}
   let end=-1;
   for(let i=0;i<this.buffer.length;i++){
    const c=this.buffer[i];if((/[.!?]/.test(c)&&/\s/.test(this.buffer[i+1]||'')&&!/\d\.\d/.test(this.buffer.slice(Math.max(0,i-1),i+2)))||c==='\n'){if(i>=12){end=i+1;break;}}
   }
   if(end<0&&this.buffer.length>=this.chunkSize){end=this.buffer.lastIndexOf(' ',this.chunkSize);if(end<20)end=this.chunkSize;}
   if(end<0){if(!final)return;end=this.buffer.length;}
   const part=this.buffer.slice(0,end).trim().replace(/[#*_`]/g,'').slice(0,this.maxChars-this.used);this.buffer=this.buffer.slice(end).trimStart();
   if(part){this.used+=part.length;this.segments++;this.emit(part);}
  }
 }
}

// One audible segment and at most one prefetched segment. No stale audio after abort.
export class SpeechQueue {
 constructor({prepare,play,signal,onError=error=>{}}){Object.assign(this,{prepare,play,signal,onError});this.pending=[];this.running=null;this.prefetched=null;this.playing=false;this.error=null;}
 add(text){if(this.signal.aborted||this.error)return;this.pending.push(text);if(this.playing)this.prime();if(!this.running){this.running=this.run().catch(error=>{this.error=error;this.pending=[];this.onError(error);}).finally(()=>{this.running=null;});}}
 load(text){return Promise.resolve().then(()=>{this.signal.throwIfAborted();return this.prepare(text,this.signal);}).then(file=>({file}),error=>({error}));}
 prime(){if(!this.prefetched&&this.pending.length&&!this.signal.aborted)this.prefetched=this.load(this.pending.shift());}
 async run(){
  while(this.pending.length||this.prefetched){
   this.signal.throwIfAborted();const request=this.prefetched||this.load(this.pending.shift());this.prefetched=null;
   const result=await request;this.signal.throwIfAborted();if(result.error)throw result.error;
   this.playing=true;const playback=this.play(result.file);this.prime();
   try{await playback;}finally{this.playing=false;}
  }
 }
 async finish(){while(this.running)await this.running;if(this.error)throw this.error;this.signal.throwIfAborted();}
}
