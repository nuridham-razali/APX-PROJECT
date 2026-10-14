import test from 'node:test';
import assert from 'node:assert/strict';
import {apexActivity,cloudMotion} from '../components/nova/state-motion.mjs';

test('NOVA preserves APEX processing and thinking alias and other core states',()=>{
  assert.equal(apexActivity('processing'),apexActivity('thinking'));
  assert.equal(apexActivity('listening'),'listening');
  assert.equal(apexActivity('speaking'),'speaking');
  assert.equal(apexActivity('idle'),'standby');
});
test('cloud audio modulation stops immediately and previews never substitute for real audio',()=>{
  const base={phase:'speaking',inputLevel:0,outputLevel:0,preview:false};
  const quiet=cloudMotion(base),loud=cloudMotion({...base,outputLevel:.8});
  assert.equal(quiet.pulse,0);assert.equal(loud.pulse,.8);
  assert.ok(loud.speed>quiet.speed);
  assert.equal(cloudMotion({...base,phase:'idle',outputLevel:.8}).pulse,0);
  assert.equal(cloudMotion({...base,outputLevel:0}).pulse,0);
  assert.ok(cloudMotion({...base,preview:true}).pulse>0);
  assert.equal(cloudMotion({...base,outputLevel:NaN}).pulse,0);
});
test('cloud states have distinct gathering and turbulence without inventing microphone activity',()=>{
  const base={phase:'idle',inputLevel:0,outputLevel:0,preview:false};
  const idle=cloudMotion(base),listening=cloudMotion({...base,phase:'listening'}),thinking=cloudMotion({...base,phase:'thinking'});
  assert.equal(listening.gather,1);assert.equal(listening.pulse,0);
  assert.ok(thinking.turbulence>listening.turbulence);
  assert.ok(listening.speed>idle.speed);
  assert.deepEqual(thinking,cloudMotion({...base,phase:'processing'}));
});
