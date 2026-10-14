export class FluxCapture {
  constructor({fetcher=(...args)=>globalThis.fetch(...args),getStream=()=>navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}}),getContext=()=>new AudioContext(),getNode=context=>new AudioWorkletNode(context,'apex-pcm',{processorOptions:{inputSampleRate:context.sampleRate}}),onTranscript=words=>{},onTurn=words=>{},onError=message=>{},onState=state=>{},onSpeechStart=()=>{},onLevel=level=>{}}={}){
    Object.assign(this,{fetcher,getStream,getContext,getNode,onTranscript,onTurn,onError,onState,onSpeechStart,onLevel});this.generation=0;this.session=null;
  }
  async post(path,body,signal){const r=await this.fetcher(`/api/runtime/voice/flux/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Deepgram Flux request failed.');return data;}
  async start({continuous=false,autoReconnect=false,retryAttempt=0}={}){
    this.stop();const g=this.generation;this.onState?.('connecting');
    const session={g,id:'',stream:null,context:null,node:null,source:null,mute:null,queue:[],pumping:false,controller:new AbortController(),manual:null,forceEnd:false,continuous:continuous===true,autoReconnect,retryAttempt,finalTurns:new Set()};this.session=session;
    const current=()=>this.session===session&&this.generation===g;
    try{
      const stream=await this.getStream();session.stream=stream;if(!current()){stream.getTracks().forEach(t=>t.stop());return false;}
      const context=this.getContext();session.context=context;await context.resume();if(!current())return false;
      await context.audioWorklet.addModule('/apex-pcm-worklet.js');if(!current())return false;
      const data=await this.post('start',{continuous:session.continuous},session.controller.signal);session.id=data.id;
      if(!current()){void this.post('stop',{id:data.id}).catch(()=>{});return false;}
      const node=this.getNode(context);session.node=node;
      session.source=context.createMediaStreamSource(stream);session.mute=context.createGain();session.mute.gain.value=0;
      session.source.connect(node);node.connect(session.mute);session.mute.connect(context.destination);
      node.port.onmessage=event=>{if(!current()||session.paused)return;if(session.queue.length>=4){this.fail(session,'Audio connection is falling behind. Start the microphone again.');return;}const pcm=new DataView(event.data);let power=0;for(let i=0;i<pcm.byteLength;i+=2)power+=(pcm.getInt16(i,true)/32768)**2;this.onLevel?.(Math.min(1,Math.sqrt(power/(pcm.byteLength/2))*4));session.queue.push(event.data);void this.pump(session);};
      session.retryAttempt=0;this.onState?.('listening');return true;
    }catch(e){if(current())this.fail(session,e?.name==='NotAllowedError'?'Microphone permission was denied.':e?.name==='NotFoundError'?'No microphone was found.':e?.name==='NotReadableError'?'The microphone is busy or unavailable to the browser.':e?.name==='SecurityError'?'Microphone access is blocked for this page.':e instanceof Error?e.message:'APEX microphone could not start.');return false;}
  }
  async pump(session){
    if(session.pumping||this.session!==session)return;session.pumping=true;
    try{while(session.queue.length&&this.session===session){
      const bytes=new Uint8Array(session.queue.shift());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      const forceEnd=session.forceEnd;session.forceEnd=false;const pauseEpoch=session.pauseEpoch;
      const data=await this.post('audio',{id:session.id,audio:btoa(binary),...(forceEnd?{forceEnd:true}:{})},session.controller.signal);
      if(this.session!==session)return;
      if(session.paused||session.pauseEpoch!==pauseEpoch)continue;
      for(const event of data.events||[]){
        if(session.paused)break;
        if(event.event==='StartOfTurn'){this.onSpeechStart?.();if(this.session!==session)return;}
        if(event.transcript)this.onTranscript?.(event.transcript);
        if(event.event==='EndOfTurn'){
          const text=event.transcript?.trim()||'';if(Number.isInteger(event.turnIndex)){if(session.finalTurns.has(event.turnIndex))continue;session.finalTurns.add(event.turnIndex);if(session.finalTurns.size>64)session.finalTurns.delete(session.finalTurns.values().next().value);}
          const manual=session.manual;session.manual=null;if(!session.continuous)this.stop();
          if(manual){clearTimeout(manual.timer);manual.resolve(text);}else if(text)this.onTurn?.(text);
          else if(!session.continuous)this.onError?.('No clear speech detected. Start the microphone again.');if(!session.continuous)return;
        }
      }
    }}catch(e){if(this.session===session)this.fail(session,e instanceof Error?e.message:'APEX audio stream failed.');}
    finally{session.pumping=false;}
  }
  pause(){const session=this.session;if(!session)return;session.pauseEpoch=(session.pauseEpoch||0)+1;session.paused=true;session.queue.length=0;session.stream?.getTracks().forEach(t=>{t.enabled=false;});this.onLevel?.(0);this.onState?.('paused');}
  resume(){const session=this.session;if(!session?.paused)return;session.paused=false;session.stream?.getTracks().forEach(t=>{t.enabled=true;});this.onState?.('listening');}
  finish(){const session=this.session;if(!session?.id)return Promise.resolve('');if(session.manual)return session.manual.promise;let resolve;const promise=new Promise(r=>{resolve=r;});const timer=setTimeout(()=>this.fail(session,'Deepgram did not finish the turn. Try a shorter request.'),10000);session.manual={promise,resolve,timer};session.forceEnd=true;return promise;}
  fail(session,message){
    if(this.session!==session)return;
    const retry=session.autoReconnect&&!/permission|denied|No microphone|blocked for this page|invalid format|needs DEEPGRAM/i.test(message);
    const attempt=session.retryAttempt+1;
    this.stop();this.onError?.(message+(retry?' Reconnecting automatically…':''));
    if(retry)this.retryTimer=setTimeout(()=>{this.retryTimer=null;void this.start({continuous:session.continuous,autoReconnect:true,retryAttempt:attempt});},Math.min(30000,1000*2**Math.min(attempt,5)));
  }
  stop(){
    if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}
    this.generation++;const session=this.session;this.session=null;
    if(session){session.controller.abort();session.queue.length=0;session.stream?.getTracks().forEach(t=>t.stop());if(session.node){session.node.port.onmessage=null;session.node.disconnect();}session.source?.disconnect();session.mute?.disconnect();void session.context?.close().catch(()=>{});if(session.manual){clearTimeout(session.manual.timer);session.manual.resolve('');}if(session.id)void this.post('stop',{id:session.id}).catch(()=>{});}
    this.onLevel?.(0);this.onState?.('idle');
  }
}
