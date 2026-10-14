import {randomUUID} from "node:crypto";
import {fishStatus,FISH_MODEL} from "./fish-voice.mjs";
export const APEX_TTS_MODEL=FISH_MODEL;
export const APEX_STT_MODEL="flux-general-en";
export function apexVoiceStatus(env=process.env){const voice=fishStatus(env,"APEX");return {ready:Boolean(env.DEEPGRAM_API_KEY?.trim()),speechReady:voice.ready,recognition:"Deepgram Flux English",speech:"Fish Audio",model:APEX_STT_MODEL,ttsModel:APEX_TTS_MODEL,voiceId:voice.voiceId,local:false};}

// The permanent key is used only here. Local HTTP carries short PCM chunks;
// this persistent server WebSocket streams them to the Flux v2 endpoint.
export class FluxSessions {
  constructor({env=process.env,socketFactory=(url,protocols)=>new WebSocket(url,protocols),now=()=>Date.now()}={}){this.env=env;this.socketFactory=socketFactory;this.now=now;this.sessions=new Map();}
  status(){return apexVoiceStatus(this.env);}
  async start({continuous=false}={}){
    if(!this.status().ready)throw new Error('APEX recognition needs DEEPGRAM_API_KEY in .env.local. Restart the runtime after adding it.');
    if(!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(this.env.DEEPGRAM_API_KEY.trim()))throw new Error('DEEPGRAM_API_KEY has an invalid format. Paste only the raw key from your Deepgram project, without a Token or Bearer prefix, brackets or extra text. Save and restart the runtime.');
    this.sweep();if(this.sessions.size>=3)throw new Error('Too many APEX microphone sessions. Stop an existing session first.');
    // Ask Flux to prioritize the assistant name, then apply a conservative
    // local phonetic fallback for common English transcription errors.
    const id=randomUUID(),url=`wss://api.deepgram.com/v2/listen?model=${APEX_STT_MODEL}&encoding=linear16&sample_rate=16000&eot_timeout_ms=1500&keyterm=${encodeURIComponent('APEX')}`;
    const socket=this.socketFactory(url,['token',this.env.DEEPGRAM_API_KEY.trim()]);
    const session={id,socket,events:[],created:this.now(),last:this.now(),error:'',closed:false,finished:false,continuous:continuous===true,ended:false,finalTurns:new Set()};this.sessions.set(id,session);
    try{await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Deepgram Flux connection timed out.')),10000);
      const done=(error)=>{clearTimeout(timer);error?reject(error):resolve();};
      socket.onopen=()=>done();
      socket.onerror=()=>{session.error='Deepgram Flux connection failed. Check the key, credits and internet access.';done(new Error(session.error));};
      socket.onclose=()=>{session.closed=true;done(new Error('Deepgram Flux closed the connection.'));};
      socket.onmessage=event=>{
        let data;try{data=JSON.parse(String(event.data));}catch{return;}
        if(data.type==='Error'){session.error='Deepgram Flux rejected the audio stream. Check the account and model access.';session.closed=true;try{socket.close();}catch{}return;}
        if(data.type==='TurnInfo'&&['StartOfTurn','Update','EndOfTurn'].includes(data.event)&&!session.finished){
          if(data.event==='StartOfTurn')session.ended=false;
          if(data.event==='EndOfTurn'){
            const turn=Number.isInteger(data.turn_index)?data.turn_index:null;
            if(turn!==null?session.finalTurns.has(turn):session.ended)return;
            if(turn!==null){session.finalTurns.add(turn);if(session.finalTurns.size>64)session.finalTurns.delete(session.finalTurns.values().next().value);}
            session.ended=true;if(!session.continuous)session.finished=true;
          }
          const update={...(Number.isInteger(data.turn_index)?{turnIndex:data.turn_index}:{}),event:data.event,transcript:typeof data.transcript==='string'?data.transcript.slice(0,16000):''};
          // Drop superseded interim text; preserve the final event exactly once.
          session.events=session.events.filter(x=>x.event!=='Update');session.events.push(update);session.events=session.events.slice(-8);
        }
      };
    });if(session.closed||session.error)throw new Error(session.error||'Deepgram Flux disconnected.');return {id,model:APEX_STT_MODEL,sampleRate:16000};}catch(error){this.stop(id);throw error;}
  }
  audio(body){
    const session=this.sessions.get(body.id);if(!session)throw new Error('APEX microphone session expired. Start it again.');
    if(this.now()-session.created>300000||this.now()-session.last>60000){this.stop(body.id);throw new Error('APEX microphone session expired. Start it again.');}
    if(session.error||session.closed){const error=session.error||'Deepgram Flux disconnected. Start the microphone again.';this.stop(body.id);throw new Error(error);}
    session.last=this.now();
    if(body.audio!==undefined){
      if(typeof body.audio!=='string'||body.audio.length>22000||! /^[A-Za-z0-9+/]*={0,2}$/.test(body.audio))throw new Error('Invalid Flux PCM audio chunk.');
      const bytes=Buffer.from(body.audio,'base64');if(!bytes.length||bytes.length>16000||bytes.length%2)throw new Error('Flux audio must be a bounded mono linear16 chunk.');
      if(!session.finished){if(session.socket.bufferedAmount>64000)throw new Error('Deepgram stream is falling behind. Stop and start the microphone again.');session.socket.send(bytes);}
    }
    if(body.forceEnd===true&&!session.finished)session.socket.send(JSON.stringify({type:'ForceEndTurn'}));
    return {events:session.events.splice(0)};
  }
  stop(id){const session=this.sessions.get(id);if(!session)return;this.sessions.delete(id);try{session.socket.close();}catch{}}
  sweep(){for(const session of this.sessions.values())if(this.now()-session.last>60000||this.now()-session.created>300000)this.stop(session.id);}
  close(){for(const id of this.sessions.keys())this.stop(id);}
}
