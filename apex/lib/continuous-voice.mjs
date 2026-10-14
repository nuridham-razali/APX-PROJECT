// Local silence detection. Only a sustained voiced segment can finish an utterance.
export class SpeechGate {
  constructor({silenceMs=1100,minVoiceMs=260}={}) {
    this.silenceMs=silenceMs; this.minVoiceMs=minVoiceMs;
    this.previous=null; this.lastVoice=null; this.voicedMs=0; this.noise=.003; this.finished=false;
  }
  sample(rms,now) {
    if(this.finished || !Number.isFinite(rms) || !Number.isFinite(now)) return false;
    const dt=this.previous===null?0:Math.max(0,Math.min(150,now-this.previous)); this.previous=now;
    const threshold=Math.max(.014,this.noise*3);
    if(rms>threshold) {if(!this.hasSpeech&&this.lastVoice!==null&&now-this.lastVoice>300)this.voicedMs=0;this.voicedMs+=dt;this.lastVoice=now;}
    else if(this.lastVoice===null) this.noise=this.noise*.98+Math.min(rms,.01)*.02;
    if(this.voicedMs>=this.minVoiceMs && this.lastVoice!==null && now-this.lastVoice>=this.silenceMs) {this.finished=true;return true;}
    return false;
  }
  get hasSpeech(){return this.voicedMs>=this.minVoiceMs;}
}

// A half-duplex loop: capture is stopped before recognition, inference, and playback.
// Each adapter runs against the current React refs; generation prevents stale restarts.
export class ContinuousVoice {
  constructor(adapters) {this.adapters=adapters;this.enabled=false;this.generation=0;this.captureGeneration=0;this.accepting=false;this.timer=null;this.announcements=new Map();}
  queueAnnouncement(key,message){if(!this.enabled||!this.adapters.announce)return;this.announcements.set(key,message);if(this.announcements.size>10)this.announcements.delete(this.announcements.keys().next().value);}
  async announce(g){
    if(!this.current(g)||!this.announcements.size||!this.adapters.announce)return;
    const [key,message]=this.announcements.entries().next().value;
    this.announcements.delete(key);this.publish('announcing');
    const completed=await this.adapters.announce(message);
    if(this.current(g)&&!completed)throw new Error('Task update speech failed. The task remains available in Tasks.');
  }
  async quiet(g){
    if(!this.current(g)||!this.accepting||!this.announcements.size)return;
    this.accepting=false;++this.captureGeneration;this.adapters.stopCapture();
    try{await this.announce(g);if(this.current(g))this.resume(g);}catch(e){this.fail(g,e instanceof Error?e.message:'Task update speech failed.');}
  }
  resume(g){this.publish('resuming');this.timer=setTimeout(()=>{this.timer=null;void this.listen(g);},600);}
  publish(status,error=''){this.adapters.onChange({enabled:this.enabled,status,error});}
  async start(){if(this.enabled)return;this.enabled=true;const g=++this.generation;this.publish('starting');await this.listen(g);}
  current(g){return this.enabled&&g===this.generation;}
  async listen(g){
    if(!this.current(g))return;
    if(this.announcements.size){try{await this.announce(g);if(this.current(g))this.resume(g);}catch(e){this.fail(g,e instanceof Error?e.message:'Task update speech failed.');}return;}
    const captureId=++this.captureGeneration;
    this.accepting=true;this.publish('listening');
    try {
      const started=await this.adapters.capture({onUtterance:kind=>{if(captureId===this.captureGeneration)void this.utterance(g,kind);},onQuiet:()=>{if(captureId===this.captureGeneration)void this.quiet(g);},onError:message=>{if(captureId===this.captureGeneration)this.fail(g,message);}});
      if(this.current(g)&&!started)this.fail(g,'Microphone could not start. Check permission and try again.');
    }catch(e){this.fail(g,e instanceof Error?e.message:'Microphone could not start.');}
  }
  async utterance(g,kind){
    if(!this.current(g)||!this.accepting)return;
    this.accepting=false;
    if(kind==='idle'){this.adapters.stopCapture();await this.listen(g);return;}
    try {
      this.publish('transcribing');
      const words=await this.adapters.transcribe();
      if(!this.current(g))return;
      if(!words?.trim())throw new Error('No clear speech detected. Voice conversation paused; try again or type your request.');
      const command=words.toLowerCase().replace(/[.,!?]/g,'').replace(/\s+/g,' ').trim();
      if(/^(nova )?(stop listening|stop (the )?voice conversation|end (the )?voice conversation)$/.test(command)){this.stop();return;}
      this.publish('responding');
      const completed=await this.adapters.respond(words);
      if(!this.current(g))return;
      if(!completed)throw new Error('Voice conversation paused. Check the reply or error in chat, then start again.');
      // A short quiet gap prevents the tail of speaker audio becoming the next input.
      this.resume(g);
    }catch(e){this.fail(g,e instanceof Error?e.message:'Voice conversation paused.');}
  }
  fail(g,message){if(!this.current(g))return;this.stop();this.publish('paused',message);}
  stop(){this.enabled=false;this.generation++;this.accepting=false;this.announcements.clear();clearTimeout(this.timer);this.timer=null;this.adapters.stopCapture();this.adapters.stopOutput();this.adapters.cancelTurn();this.publish('off');}
}
