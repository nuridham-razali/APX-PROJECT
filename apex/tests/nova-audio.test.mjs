import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceFeatures} from '../components/nova/audio-features.mjs';

const silence = new Uint8Array(512).fill(128);
const speech = Uint8Array.from({length:512},(_,i)=>128+Math.round(30*Math.sin(i*.4)));
const spectrum = bin => {const values=new Uint8Array(256);values[bin]=255;return values;};
test('silence settles to zero and loud syllables rise faster than they decay',()=>{
  const start=voiceFeatures(speech,spectrum(10),48000,512,{level:0,tone:0},.016);
  const release=voiceFeatures(silence,spectrum(10),48000,512,start,.016);
  assert.ok(start.level>0);
  assert.ok(release.level<start.level);
  assert.ok(start.level-release.level<start.level);
  let quiet=start;
  for(let i=0;i<120;i++) quiet=voiceFeatures(silence,spectrum(10),48000,512,quiet,.016);
  assert.ok(quiet.level<.000001);
  assert.ok(quiet.tone<.000001);
});
test('higher voice spectrum yields a higher tone feature without changing loudness',()=>{
  const low=voiceFeatures(speech,spectrum(3),48000,512,undefined,.1);
  const high=voiceFeatures(speech,spectrum(30),48000,512,undefined,.1);
  assert.equal(low.level,high.level);
  assert.ok(high.tone>low.tone);
});
