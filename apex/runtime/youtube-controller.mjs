import {resolve,join} from 'node:path';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright-core';

export function youtubeWatchUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='www.youtube.com'||url.pathname!=='/watch'||!/^[\w-]{11}$/.test(url.searchParams.get('v')||''))throw new Error('No valid YouTube video was selected.');
 return url.href;
}
export function playbackVerified(state){return !!state&&!state.paused&&!state.ended&&!state.muted&&state.volume>0&&state.readyState>=2&&state.currentTime>state.startedAt+0.25&&!state.ad;}

// Owns only an APEX media browser/profile. No attachment to the user's normal
// browser, arbitrary URLs, remote debugging port, scripts or model tool strings.
export class YouTubeController{
 constructor({env=process.env,browserType=chromium}={}){this.env=env;this.browserType=browserType;this.context=null;this.page=null;this.queue=Promise.resolve();}
 execute(intent,options={}){
  const run=this.queue.catch(()=>{}).then(()=>this.run(intent,options));
  this.queue=run.catch(()=>{});return run;
 }
 async open(executable){
  if(!this.context){
   const profile=resolve(this.env.APEX_DATA_DIR||'.apex-data','media-browser');mkdirSync(profile,{recursive:true});
   this.context=await this.browserType.launchPersistentContext(profile,{executablePath:executable,headless:false,viewport:null,locale:'en-US',acceptDownloads:false,chromiumSandbox:true,timeout:20000});
   this.context.on('close',()=>{this.context=null;this.page=null;});
  }
  if(!this.page||this.page.isClosed())this.page=await this.context.newPage();
  return this.page;
 }
 async run(intent,{signal,executable}={}){
  signal?.throwIfAborted();
  if(!['play','fullscreen','exit_fullscreen','pause','resume'].includes(intent.action))throw new Error('Unsupported media action.');
  if(intent.action!=='play'&&(!this.page||this.page.isClosed()))throw new Error('No APEX-controlled YouTube video is open. Ask APEX to play a video first.');
  if(intent.action==='play'&&(typeof intent.query!=='string'||!intent.query.trim()||intent.query.length>1500))throw new Error('Provide a video name of at most 1500 characters.');
  const timeout=AbortSignal.timeout(70000),active=signal?AbortSignal.any([signal,timeout]):timeout;
  let page;
  const abort=()=>{if(page&&!page.isClosed())void page.close().catch(()=>{});};active.addEventListener('abort',abort,{once:true});
  try{
   page=intent.action==='play'?await this.open(executable):this.page;active.throwIfAborted();
   page.setDefaultTimeout(12000);await page.bringToFront();
   if(intent.action==='play'){
    const search=new URL('https://www.youtube.com/results');search.searchParams.set('search_query',intent.query);
    await page.goto(search.href,{waitUntil:'domcontentloaded',timeout:25000});
    const reject=page.getByRole('button',{name:/^Reject all$/i});if(await reject.count())await reject.first().click();
    const video=page.locator('ytd-video-renderer a#video-title[href^="/watch?"]').first();
    await video.waitFor({state:'visible',timeout:15000});
    const href=await video.getAttribute('href');youtubeWatchUrl(new URL(href,'https://www.youtube.com').href);
    await video.click();await page.waitForURL(url=>url.hostname==='www.youtube.com'&&url.pathname==='/watch',{timeout:20000});
    await page.locator('video').first().waitFor({state:'attached',timeout:15000});
   }
   const url=youtubeWatchUrl(page.url());
   if(intent.action==='pause'){
    if(!(await page.locator('video').first().evaluate(v=>v.paused)))await page.locator('.ytp-play-button').click();
    await page.waitForFunction(()=>document.querySelector('video')?.paused,{},{timeout:5000});
    return {action:'pause',url,paused:true,verified:true};
   }
   if(intent.action==='fullscreen'||intent.action==='exit_fullscreen'){
    const target=intent.action==='fullscreen';const current=await page.evaluate(()=>!!document.fullscreenElement);
    if(current!==target)await page.locator('.ytp-fullscreen-button').click();
    await page.waitForFunction(target=>!!document.fullscreenElement===target,target,{timeout:5000});
    return {action:intent.action,url,fullscreen:target,verified:true};
   }
   // Let pre-roll ads finish. Ad playback cannot verify the requested video.
   await page.waitForFunction(()=>!document.querySelector('#movie_player.ad-showing'),null,{timeout:45000});
   const state=await page.locator('video').first().evaluate(v=>({paused:v.paused,muted:v.muted,currentTime:v.currentTime}));
   if(state.muted)await page.locator('.ytp-mute-button').click();
   if(state.paused)await page.locator('.ytp-play-button').click();
   // Replay may reset an ended video's clock to zero. Measure from the clock
   // after clicking Play, rather than the previous video's final timestamp.
   const startedAt=await page.locator('video').first().evaluate(v=>v.currentTime);
   await page.waitForFunction(start=>{const v=document.querySelector('video');return v&&!v.paused&&!v.ended&&!v.muted&&v.volume>0&&v.readyState>=2&&v.currentTime>start+0.25&&!document.querySelector('#movie_player.ad-showing');},startedAt,{timeout:12000});
   const measured=await page.locator('video').first().evaluate(v=>({paused:v.paused,ended:v.ended,muted:v.muted,volume:v.volume,readyState:v.readyState,currentTime:v.currentTime,ad:!!document.querySelector('#movie_player.ad-showing')}));
   measured.startedAt=startedAt;
   if(!playbackVerified(measured))throw new Error('The requested video did not start playing.');
   let fullscreen=await page.evaluate(()=>!!document.fullscreenElement);
   if(intent.fullscreen&&!fullscreen){await page.locator('.ytp-fullscreen-button').click();await page.waitForFunction(()=>!!document.fullscreenElement,null,{timeout:5000});fullscreen=true;}
   const title=(await page.locator('h1.ytd-watch-metadata').innerText().catch(()=>page.title())).trim();
   return {action:intent.action,url,title,playing:true,fullscreen,verified:true,playback:measured};
  }catch(error){
   if(active.aborted)throw new Error(signal?.aborted?'YouTube action cancelled.':'YouTube action timed out; playback was not verified.');
   if(error.name==='TimeoutError')throw new Error('YouTube did not confirm the action. A consent/sign-in prompt, advert or unavailable video may be blocking it.');
   throw error;
  }finally{active.removeEventListener('abort',abort);}
 }
 async close(){await this.context?.close();this.context=null;this.page=null;}
}
