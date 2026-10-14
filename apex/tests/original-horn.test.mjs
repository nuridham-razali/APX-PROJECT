import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalHorn} from '../lib/original-horn.mjs';

function audioFixture(){
 const nodes=[];
 const param=()=>({value:0,events:[],setValueAtTime(...args){this.events.push(['set',...args]);},setValueCurveAtTime(...args){this.events.push(['curve',...args]);},exponentialRampToValueAtTime(...args){this.events.push(['ramp',...args]);}});
 const node=type=>{const n={kind:type,gain:param(),frequency:param(),detune:param(),pan:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){this.disconnected=true;},start(t){this.started=t;},stop(t){this.stopped=t;}};nodes.push(n);return n;};
 const context={currentTime:10,sampleRate:100,createDynamicsCompressor:()=>node('compressor'),createGain:()=>node('gain'),createConvolver:()=>node('convolver'),createOscillator:()=>node('oscillator'),createBufferSource:()=>node('noise'),createBiquadFilter:()=>node('filter'),createWaveShaper:()=>node('shaper'),createStereoPanner:()=>node('panner'),createBuffer:(channels,length)=>({getChannelData:()=>new Float32Array(length)})};
 return {context,nodes};
}
test('original Tripod retains formants and schedules the overlapping 41 Hz bass tail',()=>{
 const {context,nodes}=audioFixture();const horn=createOriginalHorn(context,{connect(){}});horn.play(10);
 const saws=nodes.filter(n=>n.kind==='oscillator'&&n.type==='sawtooth');
 assert.equal(saws.length,3);assert.ok(saws.every(n=>n.started===10&&Math.abs(n.stopped-13.32)<1e-9));
 const curve=saws[0].frequency.events.find(e=>e[0]==='curve');assert.equal(curve[3],3.2);
 const bands=nodes.filter(n=>n.kind==='filter'&&n.type==='bandpass').map(n=>n.frequency.value);
 for(const frequency of [205,540,1150])assert.ok(bands.includes(frequency));
 const tail=nodes.find(n=>n.kind==='oscillator'&&n.frequency.events.some(e=>e[0]==='set'&&e[1]===41));
 assert.ok(tail);assert.equal(tail.started,10+3.2*.72);assert.equal(tail.stopped,tail.started+2.6+.05);
 const compressor=nodes.find(n=>n.kind==='compressor');assert.equal(compressor.threshold.value,-8);assert.equal(compressor.ratio.value,3.5);
 horn.stop();assert.ok(nodes.filter(n=>n.kind==='oscillator'||n.kind==='noise').every(n=>n.stopped===undefined));
});
