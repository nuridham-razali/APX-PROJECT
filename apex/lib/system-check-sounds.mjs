import {createOriginalHorn} from './original-horn.mjs';
// Shockwave has a dedicated 4x louder output bus; other effects retain their levels.
// Local synthesized effects; the shockwave uses the supplied original engine.
export class SystemCheckSounds{
  constructor(){this.context=new AudioContext();this.master=this.context.createGain();this.master.connect(this.context.destination);this.master.gain.value=.07;this.shockwaveOutput=this.context.createGain();this.shockwaveOutput.connect(this.context.destination);this.shockwaveOutput.gain.value=.28;this.muted=false;this.volume=.35;this.tail=0;this.scanners=[];}
  async resume(){await this.context.resume();}
  configure(muted,volume){this.muted=muted;this.volume=Math.max(0,Math.min(1,volume));this.applyVolume();}
  applyVolume(){const level=this.muted?0:this.volume*(this.ducked?.2:1);this.master.gain.setTargetAtTime(level*.2,this.context.currentTime,.04);this.shockwaveOutput.gain.setTargetAtTime(level*.8,this.context.currentTime,.04);}
  duck(speaking){this.ducked=speaking;this.applyVolume();}
  note(frequency,start,duration=.12,type='sine',gain=.6){const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=frequency;o.connect(g);g.connect(this.master);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(gain,start+.012);g.gain.exponentialRampToValueAtTime(.001,start+duration);o.start(start);o.stop(start+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  activation(){const t=this.context.currentTime;this.note(440,t,.12);this.note(880,t+.09,.18);}
  noise(start,duration,gain=.4,frequency=650){const c=this.context,b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=c.createBufferSource(),filter=c.createBiquadFilter(),envelope=c.createGain();source.buffer=b;filter.type='lowpass';filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(85,start+duration);source.connect(filter);filter.connect(envelope);envelope.connect(this.master);envelope.gain.setValueAtTime(.001,start);envelope.gain.exponentialRampToValueAtTime(gain,start+.035);envelope.gain.exponentialRampToValueAtTime(.001,start+duration);source.start(start);source.stop(start+duration);source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();};}
  glide(from,to,start,duration,gain=.5,type='sine'){const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(from,start);o.frequency.exponentialRampToValueAtTime(to,start+duration);o.connect(g);g.connect(this.master);g.gain.setValueAtTime(.001,start);g.gain.exponentialRampToValueAtTime(gain,start+duration*.18);g.gain.exponentialRampToValueAtTime(.001,start+duration);o.start(start);o.stop(start+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  cue(name){const t=this.context.currentTime;
    if(name==='fade'){this.glide(650,90,t,.85,.25,'triangle');this.noise(t,.8,.18,1200);}
    if(name==='core')this.glide(65,145,t,1.25,.6);
    if(name==='intensity'){this.note(220,t,1.25,'sine',.5);this.note(440,t+.05,.85,'sine',.2);}
    if(name==='connections'){[0,.12,.24,.36].forEach((d,i)=>this.note(780+i*95,t+d,.055,'triangle',.16));this.glide(350,950,t,.6,.15);}
    if(name==='nodes'){[510,640,760,570,880,690,990].forEach((f,i)=>this.note(f,t+i*.115,.085,'sine',.22));}
    if(name==='circuits'){this.noise(t,.4,.09,1800);this.glide(480,1100,t,.5,.11);}
    if(name==='waves')this.scan();
    if(name==='shockwave'){this.horn??=createOriginalHorn(this.context,this.shockwaveOutput);this.horn.play(t);}
    if(name==='settle')this.chirp();
  }
  chirp(){const t=this.context.currentTime;[1250,1670,2050].forEach((f,i)=>{this.glide(f*.8,f,t+i*.11,.11,.3);this.note(f,t+i*.11+.2,.16,'sine',.065);});}
  scan(){if(this.scanners.length)return;const c=this.context;for(const frequency of [58,116]){const o=c.createOscillator(),g=c.createGain();o.frequency.value=frequency;g.gain.value=.055;o.connect(g);g.connect(this.master);o.start();this.scanners.push({o,g});}
    const b=c.createBuffer(1,c.sampleRate,c.sampleRate),data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const o=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain(),lfo=c.createOscillator(),mod=c.createGain();o.buffer=b;o.loop=true;filter.type='bandpass';filter.frequency.value=700;filter.Q.value=.8;g.gain.value=.035;lfo.frequency.value=.22;mod.gain.value=380;lfo.connect(mod);mod.connect(filter.frequency);o.connect(filter);filter.connect(g);g.connect(this.master);o.start();lfo.start();this.scanners.push({o,g},{o:lfo,g:mod});o.onended=()=>filter.disconnect();
  }
  stopScan(fade=false){for(const {o,g} of this.scanners){if(fade){g.gain.setTargetAtTime(.0001,this.context.currentTime,.12);o.stop(this.context.currentTime+.6);o.onended=()=>{o.disconnect();g.disconnect();};}else{o.stop();o.disconnect();g.disconnect();}}this.scanners=[];}
  result(state){const t=Math.max(this.context.currentTime+.01,this.tail);if(state==='passed'){this.note(1100,t,.07,'sine',.28);this.tail=t+.11;}else if(state==='failed'){this.note(330,t,.18,'triangle',.65);this.note(245,t+.16,.21,'triangle',.5);this.tail=t+.4;}}
  async complete(){this.stopScan(true);const t=Math.max(this.context.currentTime+.02,this.tail);[659.25,987.77].forEach((f,i)=>{this.note(f,t+i*.16,.3);this.note(f,t+i*.16+.22,.22,'sine',.08);});const wait=Math.max(0,(t+.65-this.context.currentTime)*1000);await new Promise(resolve=>setTimeout(resolve,wait));}
  close(){this.stopScan();this.horn?.stop();void this.context.close().catch(()=>{});}
}
