import test from 'node:test';
import assert from 'node:assert/strict';
import {WakeGate} from '../lib/wake-gate.mjs';
test('background speech is ignored, each requested wake phrase opens a request window',()=>{
 for(const phrase of ['apex','hey apex','hye apex','hello apex']){
  let now=100;const gate=new WakeGate({now:()=>now});
  assert.equal(gate.observe('ordinary background conversation'),false);
  assert.equal(gate.consume('ordinary background conversation'),null);
  assert.equal(gate.observe(phrase),true);
  assert.equal(gate.consume(phrase),phrase);
  assert.equal(gate.consume('show me your face'),'show me your face');
  assert.equal(gate.consume('unaddressed next conversation'),null);
  gate.observe(phrase);now+=20001;assert.equal(gate.consume('late speech'),null);
 }
});
test('wake and request together work; quoted and embedded wake words do not activate',()=>{
 const gate=new WakeGate();
 assert.equal(gate.consume('hello apex open humanoid view'),'hello apex open humanoid view');
 assert.equal(gate.consume('someone said apex to me'),null);
 assert.equal(gate.consume('"apex show me your face"'),null);
});
