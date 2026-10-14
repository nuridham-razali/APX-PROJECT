import test from 'node:test';
import assert from 'node:assert/strict';
import {HudResponseLifecycle,HUD_HOLD_MS,HUD_FADE_MS,exactSpeechChunks,waitForHudReveal} from '../lib/hud-response.mjs';
import {fishSpeak} from '../runtime/fish-voice.mjs';
import {spokenText} from '../lib/spoken-text.mjs';
function clock(){let now=0,id=0;const timers=new Map();return {schedule(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key;},cancel(key){timers.delete(key);},tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;},size:()=>timers.size};}
test('HUD response remains visible throughout speech, holds three seconds, then fades before removal',()=>{
 const time=clock(),changes=[];const hud=new HudResponseLifecycle(v=>changes.push(v),time);
 hud.show('one','Actual completed response.');time.tick(60000);assert.equal(changes.at(-1).stage,'visible');
 hud.finish('one');time.tick(HUD_HOLD_MS-1);assert.equal(changes.at(-1).stage,'visible');time.tick(1);assert.equal(changes.at(-1).stage,'fading');
 time.tick(HUD_FADE_MS-1);assert.equal(changes.at(-1).text,'Actual completed response.');time.tick(1);assert.equal(changes.at(-1),null);
});
test('a newer response cancels the previous fade and stale audio completion cannot hide it',()=>{
 const time=clock();let visible;const hud=new HudResponseLifecycle(v=>visible=v,time);
 hud.show('old','Old response');hud.finish('old');time.tick(HUD_HOLD_MS);assert.equal(visible.stage,'fading');
 hud.show('new','New response');hud.finish('old');time.tick(20000);assert.equal(visible.text,'New response');assert.equal(visible.stage,'visible');
 hud.finish('new');hud.dispose();assert.equal(time.size(),0);
});
test('invalid responses never produce HUD content; text-only and failed-speech replies use the same hold',()=>{
 const time=clock(),changes=[];const hud=new HudResponseLifecycle(v=>changes.push(v),time);hud.show('id',' ');assert.equal(changes.length,0);
 hud.show('id','Text is still available.');hud.finish('id');time.tick(HUD_HOLD_MS+HUD_FADE_MS);assert.equal(changes.at(-1),null);
});
test('long responses retain Unicode across chunks and Fish removes presentation markup',async()=>{
 const text='**Answer:**\n'+('  Preserve #formatting, _underscores_, and 😀 whitespace.\n'.repeat(100));
 const chunks=exactSpeechChunks(text);assert.equal(chunks.join(''),text);assert.ok(chunks.every(s=>s.length<=1500));
 const sent=[];for(const chunk of chunks)await fishSpeak({assistant:'APEX',text:chunk},{env:{FISH_API_KEY:'mock',APEX_FISH_VOICE_ID:'a'.repeat(32)},fetchImpl:async(_url,options)=>{sent.push(JSON.parse(options.body).text);return new Response(new Uint8Array([1,2,3]));}});
 assert.deepEqual(sent,chunks.map(spokenText));assert.equal(exactSpeechChunks('abc😀def',4).join(''),'abc😀def');assert.ok(exactSpeechChunks('abc😀def',4).every(s=>!/[\uD800-\uDBFF]$/.test(s)));
});
test('speech formatting removes Markdown while preserving meaningful symbols and numbers',()=>{
 assert.equal(spokenText('# Answer\n**Hello** _Idham_.\n* Read `file.ts` and [the guide](https://example.com).'),'Answer\nHello Idham.\nRead file.ts and the guide.');
 assert.equal(spokenText('C# costs $25; 2 + 2 = 4. 50%.'),'C# costs $25; 2 + 2 = 4. 50%.');
 assert.equal(spokenText('2 * 3 * 4; file_name_here.txt'),'2 * 3 * 4; file_name_here.txt');
 assert.equal(spokenText('```js\nconst value = 3;\n```'),'const value = 3;');
});
test('HUD accepts only spoken user transcripts and assistant completion cannot replace or fade them',()=>{
 const time=clock();let visible;const hud=new HudResponseLifecycle(v=>visible=v,time);
 hud.receive({type:'user',id:'apex-user-voice',text:'Check the weather'});
 hud.receive({type:'show',id:'assistant',text:'The weather is sunny'});hud.receive({type:'finish',id:'assistant'});time.tick(10000);
 assert.equal(visible.text,'Check the weather');assert.equal(visible.stage,'visible');
 hud.receive({type:'finish',id:'apex-user-voice'});time.tick(HUD_HOLD_MS+HUD_FADE_MS);assert.equal(visible,null);hud.dispose();
});
test('HUD reveal wait is cancellable and never launches speech for an interrupted response',async()=>{
 const request=new AbortController();const reveal=waitForHudReveal(request.signal);request.abort(new DOMException('Interrupted','AbortError'));await assert.rejects(reveal,{name:'AbortError'});
 assert.throws(()=>waitForHudReveal(request.signal),{name:'AbortError'});
});
