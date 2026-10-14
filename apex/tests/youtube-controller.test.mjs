import test from 'node:test';
import assert from 'node:assert/strict';
import {automationIntent,executeAutomation} from '../runtime/desktop-automation.mjs';
import {YouTubeController,youtubeWatchUrl,playbackVerified} from '../runtime/youtube-controller.mjs';
import {Store} from '../runtime/store.mjs';
import {Engine} from '../runtime/engine.mjs';

test('media voice/chat commands route only top-level requests, with fullscreen intent separated from search',()=>{
 for(const text of ['NAH PLAY LOVE YOURSELF ON YOUTUBE','Okay, Apex, can you please play LOVE YOURSELF on YouTube','Well actually play LOVE YOURSELF on YouTube'])assert.equal(automationIntent(text).query,'LOVE YOURSELF');
 for(const text of ['nah do not play Love Yourself on YouTube','okay "play Love Yourself on YouTube"','the document says nah play Love Yourself on YouTube'])assert.equal(automationIntent(text),null);
 for(const text of ['Play Blue Bird on YouTube','Open YouTube and play Blue Bird','Apex, play Blue Bird from YouTube'])assert.equal(automationIntent(text).query,'Blue Bird');
 const combined=automationIntent('play Blue Bird on YouTube in fullscreen');assert.equal(combined.fullscreen,true);assert.equal(combined.query,'Blue Bird');
 for(const text of ['fullscreen','full screen','make it fullscreen','go to full screen','Apex, put the video in fullscreen'])assert.equal(automationIntent(text).action,'fullscreen',text);
 assert.equal(automationIntent('exit fullscreen').action,'exit_fullscreen');assert.equal(automationIntent('pause the video').action,'pause');assert.equal(automationIntent('resume youtube').action,'resume');
 assert.equal(automationIntent('"Play Blue Bird on YouTube"'),null);assert.equal(automationIntent('The page says make it fullscreen'),null);
});

test('verified media receipts persist through conversation and reach the model as historical evidence (mock model)',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());let instruction;
 const receipts=[{tool:'YOUTUBE_CONTROL',action:'play',title:'Mock video',verified:true,playing:true,recordedAt:'2026-10-11T00:00:00Z'}];
 store.put('conversation',{id:'media-evidence',contents:[],actionReceipts:receipts});
 const engine=new Engine(store,{env:{APEX_PROVIDER:'gemini'},generator:async(_contents,prompt)=>{instruction=prompt;return {text:'Mock reply'};}});
 await engine.chat({message:'Why could you play the video earlier?',conversationId:'media-evidence'});
 assert.match(instruction,/Verified past media actions/);assert.match(instruction,/Mock video/);assert.match(instruction,/not current playback/);assert.match(instruction,/Never call a verified action a simulation/);
 assert.deepEqual(store.get('conversation','media-evidence').actionReceipts,receipts);
 await engine.chat({message:'Draft email to x@example.com subject: Test body: Test.',conversationId:'media-evidence'});
 assert.deepEqual(store.get('conversation','media-evidence').actionReceipts,receipts);
});
test('media verification rejects paused, muted, stalled, ended and advert playback',()=>{
 const playing={paused:false,ended:false,muted:false,volume:1,readyState:4,currentTime:12,startedAt:11,ad:false};assert.equal(playbackVerified(playing),true);
 for(const invalid of [{paused:true},{muted:true},{ended:true},{volume:0},{readyState:1},{currentTime:11},{ad:true}])assert.equal(playbackVerified({...playing,...invalid}),false);
 assert.equal(youtubeWatchUrl('https://www.youtube.com/watch?v=abcdefghijk'),'https://www.youtube.com/watch?v=abcdefghijk');
 for(const url of ['https://evil.example/watch?v=abcdefghijk','javascript:alert(1)','https://www.youtube.com/results?search_query=test'])assert.throws(()=>youtubeWatchUrl(url));
});
test('fullscreen requires an owned media session; cancellation cannot start a browser',async()=>{
 let launched=0;const controller=new YouTubeController({browserType:{launchPersistentContext:()=>{launched++;throw Error('must not launch');}}});
 await assert.rejects(controller.execute({action:'fullscreen'}),/play a video first/);
 const signal=new AbortController();signal.abort();await assert.rejects(controller.execute({action:'play',query:'Blue Bird'},{signal:signal.signal}));assert.equal(launched,0);
});
test('mocked media receipts drive completed or failed map events without model inference',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());const engine=new Engine(store,{env:{}});
 const result=await executeAutomation(engine,automationIntent('play Blue Bird on YouTube'),{platform:'win32',mediaController:{execute:async()=>({playing:true,title:'Blue Bird',verified:true,fullscreen:false})}});
 assert.match(result.message,/Playing Blue Bird/);assert.ok(store.list('node_event').some(e=>e.state==='completed'));
 await assert.rejects(executeAutomation(engine,automationIntent('fullscreen'),{platform:'win32',mediaController:{execute:async()=>({verified:false})}}),/did not verify/);
 assert.ok(store.list('node_event').some(e=>e.state==='failed'));
});
