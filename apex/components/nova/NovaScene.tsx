"use client";

import { Component, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { NOVA_VISUALS as C, type NovaSignal } from './visual-config';
import { cloudMotion } from './state-motion.mjs';

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.;v+=.5*noise3(p);p=p*2.03+3.1;v+=.25*noise3(p);p=p*2.01+1.7;v+=.125*noise3(p);p=p*2.02;v+=.0625*noise3(p);return v;}`;
const smokeFragment=`varying vec2 vUv;uniform float uTime,uLayer,uSpread,uPulse;${noise}
void main(){
  vec2 p=(vUv-.5)*2.;float t=uTime*.045;
  vec2 curl=vec2(fbm(vec3(p*2.4+vec2(t,-t*.6),uLayer)),fbm(vec3(p*2.4+vec2(-t*.5,t),uLayer+8.)))-.47;
  vec2 q=p+curl*.9;
  float billow=fbm(vec3(q*4.+vec2(t*.4,-t*.3),uLayer+3.));
  float detail=fbm(vec3(q*13.+curl*2.,uLayer+t*.3));
  float edge=(1.-smoothstep(.3,1.05,length(p*vec2(.82,1.))))*(1.-smoothstep(.7,1.,abs(p.x)))*(1.-smoothstep(.7,1.,abs(p.y)));
  float folds=smoothstep(.28,.64,billow*.6+detail*.4);
  float wisps=pow(max(0.,1.-abs(detail*2.-1.)),4.);
  vec3 purple=mix(vec3(.045,.012,.12),vec3(.27,.055,.52),billow);
  gl_FragColor=vec4(purple,edge*(folds*.65+wisps*.12)*uSpread*.5);
}`;

// Only the subtle purple background mist remains; speaking moves the orbit lines.
function GalaxySmoke({signal,motion,low}:{signal:RefObject<NovaSignal>;motion:boolean;low:boolean}){
  const viewport=useThree(s=>s.viewport);
  const meshes=useRef<(THREE.Mesh|null)[]>([]),materials=useRef<(THREE.ShaderMaterial|null)[]>([]);
  const time=useRef(0),spread=useRef(0);
  const banks=useMemo(()=>[[-.34,.25],[.34,-.23],[-.36,-.26],[.35,.28],[-.04,.37],[.06,-.36]],[]);
  const uniforms=useMemo(()=>banks.map((_,i)=>({uTime:{value:0},uLayer:{value:i*3.7},uSpread:{value:0},uPulse:{value:0}})),[banks]);
  useFrame((_,delta)=>{
    const dt=Math.min(delta,.05),s=signal.current,profile=cloudMotion(s,time.current);
    spread.current=THREE.MathUtils.lerp(spread.current,.28,1-Math.exp(-dt*.85));
    if(motion)time.current+=dt*(.6+profile.speed*.35);
    banks.forEach(([x,y],i)=>{
      const mesh=meshes.current[i],material=materials.current[i];if(!mesh||!material)return;
      const drift=time.current*.075+i*2.3,extent=1;
      mesh.position.set((x+Math.sin(drift)*.055)*viewport.width*extent,(y+Math.cos(drift*.8)*.06)*viewport.height*extent,-.95-i*.035);
      mesh.scale.set(viewport.width*(.44+spread.current*.2),viewport.height*(.55+spread.current*.24),1);
      mesh.rotation.z=Math.sin(drift*.4)*.22;
      material.uniforms.uTime.value=time.current;material.uniforms.uSpread.value=spread.current;
      material.uniforms.uPulse.value=profile.pulse;
    });
  });
  return <group>{banks.slice(0,low?2:3).map((_,i)=><mesh key={i} ref={m=>{meshes.current[i]=m;}}>
    <planeGeometry args={[1,1]}/><shaderMaterial ref={m=>{materials.current[i]=m;}} vertexShader={vertex} fragmentShader={smokeFragment} uniforms={uniforms[i]} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending}/>
  </mesh>)}</group>;
}

function SurroundingStars() {
  const {positions,seeds}=useMemo(()=>{const a=new Float32Array(C.stars*3),seeds=new Float32Array(C.stars);let seed=913;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};for(let i=0;i<C.stars;i++){a[i*3]=(r()-.5)*24;a[i*3+1]=(r()-.5)*14;a[i*3+2]=-3-r()*3;seeds[i]=r();}return{positions:a,seeds};},[]);
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]} /><bufferAttribute attach="attributes-aSeed" args={[seeds,1]} /></bufferGeometry><shaderMaterial vertexShader={`attribute float aSeed;varying float vSeed;void main(){vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=.7+pow(aSeed,8.)*2.8;}`} fragmentShader={`varying float vSeed;void main(){float r=length(gl_PointCoord-.5)*2.;float a=exp(-r*r*4.)*(.25+vSeed*.7);gl_FragColor=vec4(mix(vec3(.4,.6,.85),vec3(.95,.88,1.),vSeed),a);}`} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></points>;
}

const orbitFragment=`varying vec2 vUv;uniform float uTime,uFlow,uPulse,uBreath,uTone,uAwake,uSpeaking,uBeat;${noise}
void main(){
  vec2 p=(vUv-.5)*2.;float r=length(p);vec3 light=vec3(0.);float opacity=0.;
  for(int i=0;i<7;i++){
    float f=float(i),swing=sin(uTime*.62+f*.8)*uSpeaking*(.1+uBreath*.45)*(1.+uTone*.12);
    float turn=f*.69-uTime*(.065+f*.003)+swing*.22;
    vec2 q=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p;
    q/=vec2(.74+.12*sin(f*1.7)+swing*.09,.96+.05*cos(f)-swing*.065);
    float a=atan(q.y,q.x),distance=length(q);
    float breathing=1.+uSpeaking*(uBeat*.04+uBreath*.075);
    float radius=(.57+.042*sin(a*3.+f+uTime*.24)+.026*sin(a*2.-f*.8-uTime*.18)) *breathing;
    float d=abs(distance-radius);
    float filament=exp(-pow(d/.0023,2.));
    float halo=exp(-pow(d/.022,2.))*.4+exp(-pow(d/.065,2.))*.16;
    vec3 violetGlow=vec3(.72,.14,1.65);
    // Every point along each orbit glows; moving highlights sit above this floor.
    float arc=.78+.22*pow(.5+.5*cos(a-f*.9+uTime*.3),3.);
    // Four violet strands, two gold strands, and one white strand.
    bool goldStrand=i==1||i==5;
    vec3 color=goldStrand?vec3(2.5,1.6,.35):(i==3?vec3(2.,1.95,2.1):vec3(.72,.2,1.55));
    float haloWeight=goldStrand?.25:(i==3?.5:1.);
    float voiceLight=1.+uSpeaking*(.12+uPulse*.9);
    light+=(color*filament+violetGlow*halo*haloWeight)*arc*.8*voiceLight;
    // Moving wire pulses retain a soft idle glimmer and brighten with actual speech.
    float packetAngle=a+uFlow*(.95+f*.045)-f*1.7;
    float packet=pow(.5+.5*cos(packetAngle),70.);
    float packetStrength=.18+uSpeaking*(1.6+uPulse*3.);
    float pulseHalo=exp(-pow(d/.012,2.))*.8+exp(-pow(d/.035,2.))*.28;
    vec3 pulseColor=goldStrand?vec3(3.2,2.25,.9):vec3(2.9,2.6,3.2);
    light+=(pulseColor*filament+mix(violetGlow,pulseColor,.22)*pulseHalo)*packet*packetStrength;
    opacity=max(opacity,max((filament+halo)*arc,(filament+pulseHalo)*packet*packetStrength));
  }
  float aura=exp(-pow((r-.29)/.085,2.))*(.3+.25*fbm(vec3(p*18.,uTime*.08)));
  float mist=exp(-pow((r-.43)/.18,2.))*(.13+.25*fbm(vec3(p*9.,uTime*.08)));
  // The inner frame and particle ball are rendered by the shared APEX component.
  light+=vec3(.7,.2,1.7)*aura+vec3(.65,.16,1.35)*mist*(1.+uSpeaking*uPulse*.6);
  opacity=max(opacity,aura+mist);
  gl_FragColor=vec4(light,clamp(opacity,0.,1.));
}`;

function GlowOrbitCore({signal,motion}:{signal:RefObject<NovaSignal>;motion:boolean}){
  const material=useRef<THREE.ShaderMaterial>(null),mesh=useRef<THREE.Mesh>(null);
  const time=useRef(0),flowTime=useRef(0),radius=useRef(1),speed=useRef(.3),flowSpeed=useRef(.25),breath=useRef(0),tone=useRef(0);
  const uniforms=useMemo(()=>({uTime:{value:0},uPulse:{value:0},uFlow:{value:0},uBreath:{value:0},uTone:{value:0},uAwake:{value:0},uSpeaking:{value:0},uBeat:{value:0}}),[]);
  useFrame((_,delta)=>{
    const s=signal.current,dt=Math.min(delta,.05),profile=cloudMotion(s,time.current);
    const thinking=s.phase==='processing'||s.phase==='thinking';
    breath.current=THREE.MathUtils.lerp(breath.current,profile.pulse,1-Math.exp(-dt*2.8));
    tone.current=THREE.MathUtils.lerp(tone.current,s.phase==='speaking'&&!s.preview?(s.outputTone||0):0,1-Math.exp(-dt*3));
    speed.current=THREE.MathUtils.lerp(speed.current,thinking?.65:s.phase==='listening'?.4:s.phase==='speaking'?.21+breath.current*.05:.3,1-Math.exp(-dt*2));
    flowSpeed.current=THREE.MathUtils.lerp(flowSpeed.current,s.phase==='speaking'?.45+breath.current*.06+tone.current*.02:.22,1-Math.exp(-dt*2));
    if(motion){time.current+=dt*speed.current;flowTime.current+=Math.min(delta,.25)*flowSpeed.current;}
    radius.current=THREE.MathUtils.lerp(radius.current,s.phase==='listening'?1.2:thinking?1.12:1,1-Math.exp(-dt*3));
    if(mesh.current)mesh.current.scale.setScalar(C.orbitSize*radius.current);
    // Negative shader time makes the glowing orbits rotate anticlockwise in every state.
    if(material.current){
      const u=material.current.uniforms;
      u.uTime.value=-time.current;u.uFlow.value=-flowTime.current;u.uPulse.value=profile.pulse;u.uBreath.value=breath.current;u.uTone.value=tone.current;u.uAwake.value=s.phase==='idle'?0:1;
      u.uSpeaking.value=THREE.MathUtils.lerp(u.uSpeaking.value,s.phase==='speaking'?1:0,1-Math.exp(-dt*4));
      // Only the labeled demo uses a timed heartbeat; real speech follows its envelope.
      const cycle=(time.current*.85)%1;
      u.uBeat.value=s.preview?Math.exp(-Math.pow((cycle-.15)/.075,2))+.6*Math.exp(-Math.pow((cycle-.36)/.1,2)):breath.current;
    }
  });
  return <mesh ref={mesh} position={[0,0,.25]} scale={C.orbitSize}><planeGeometry args={[1,1]}/><shaderMaterial ref={material} vertexShader={vertex} fragmentShader={orbitFragment} uniforms={uniforms} transparent depthWrite={false} toneMapped={false}/></mesh>;
}

const trailFragment=`varying vec2 vUv;uniform float uTime,uPulse,uTone,uAspect;
void main(){
  vec2 p=(vUv-.5)*2.;vec3 light=vec3(0.);float alpha=0.;
  float outside=smoothstep(.28,.63,length(p*vec2(uAspect,1.)));
  for(int i=0;i<4;i++){
    float f=float(i),direction=mod(f,2.)<.5?1.:-1.;
    float curve=direction*(.22+.2*sin(p.x*2.7+uTime*.12+f*1.5));
    curve+=.12*sin(p.x*5.1-uTime*.18+f)+.02*uPulse*sin(p.x*8.+uTime+f);
    float slope=direction*.54*cos(p.x*2.7+uTime*.12+f*1.5)+.612*cos(p.x*5.1-uTime*.18+f);
    float d=abs(p.y-curve)/sqrt(1.+slope*slope);
    float filament=exp(-pow(d/.0018,2.));
    float halo=exp(-pow(d/.011,2.))*.15;
    float strand=(filament+halo)*outside*(.22+uPulse*.18);
    light+=mix(vec3(.42,.17,.8),vec3(.95,.65,1.25),uTone*.5)*strand;
    alpha=max(alpha,strand);
  }
  gl_FragColor=vec4(light,alpha);
}`;

// Long, faint ribbons continue beyond the core, as in the supplied motion reference.
function FlowingLightTrails({signal,motion}:{signal:RefObject<NovaSignal>;motion:boolean}){
  const viewport=useThree(s=>s.viewport),material=useRef<THREE.ShaderMaterial>(null),time=useRef(0);
  const uniforms=useMemo(()=>({uTime:{value:0},uPulse:{value:0},uTone:{value:0},uAspect:{value:1}}),[]);
  useFrame((_,delta)=>{
    const s=signal.current,profile=cloudMotion(s,time.current);
    if(motion)time.current+=Math.min(delta,.05)*(.22+profile.pulse*.16);
    if(material.current){const u=material.current.uniforms;u.uTime.value=-time.current;u.uPulse.value=profile.pulse;u.uTone.value=s.phase==='speaking'&&!s.preview?(s.outputTone||0):0;u.uAspect.value=viewport.width/viewport.height;}
  });
  return <mesh position={[0,0,-.4]} scale={[viewport.width*1.06,viewport.height*1.06,1]}><planeGeometry args={[1,1]}/><shaderMaterial ref={material} vertexShader={vertex} fragmentShader={trailFragment} uniforms={uniforms} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending}/></mesh>;
}

class SceneBoundary extends Component<{children:ReactNode;onFail:()=>void},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}componentDidCatch(){this.props.onFail();}render(){return this.state.failed?null:this.props.children;}}

function CoreComposition({signal,motion,effects,low}:{signal:RefObject<NovaSignal>;motion:boolean;effects:boolean;low:boolean}) {
  const size=useThree(s=>s.size),scale=Math.min(1,size.width/size.height*1.45);
  return <group scale={scale}><GlowOrbitCore signal={signal} motion={motion}/></group>;
}

export default function NovaScene({signal,motion,effects,low,onFail}:{signal:RefObject<NovaSignal>;motion:boolean;effects:boolean;low:boolean;onFail:()=>void}) {
  return <SceneBoundary onFail={onFail}><Canvas camera={{position:[0,0,8],fov:42}} dpr={[1,low?1:1.4]} frameloop={motion?'always':'demand'} gl={{alpha:true,antialias:!low,powerPreference:'low-power'}} onCreated={({gl,setFrameloop})=>{const el=gl.domElement;el.addEventListener('webglcontextlost',e=>{e.preventDefault();setFrameloop('never');onFail();},{once:true});}}>
    <SurroundingStars />{effects&&<GalaxySmoke signal={signal} motion={motion} low={low}/>}<FlowingLightTrails signal={signal} motion={motion}/><CoreComposition signal={signal} motion={motion} effects={effects} low={low} />
    {effects&&<EffectComposer multisampling={0}><Bloom intensity={C.bloom} luminanceThreshold={.55} luminanceSmoothing={.8} mipmapBlur /></EffectComposer>}
  </Canvas></SceneBoundary>;
}











