"use client";

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import ApexOrb from './upstream/ApexOrb';
import { coreRadius } from './hud-visuals';
import './upstream/apex-orb.css';

// Reuse the APEX-UI Three.js scene supplied in the original archive.
// Browser canvas textures and WebGL must never execute during SSR.
const ApexCore3D = dynamic(() => import('./upstream/ApexCore3D'), { ssr: false });

export default function HudParticleCore({ persona, activity, motion, showParticles = true, particleColor, secondaryParticleColor, innerGlowColor }: {
  persona: 'APEX' | 'NOVA';
  activity: 'standby' | 'listening' | 'thinking' | 'speaking';
  motion: boolean;
  showParticles?: boolean;
  particleColor?: string;
  secondaryParticleColor?: string;
  innerGlowColor?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const el = container.current!;
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      const radius = coreRadius(width, height, persona, activity);
      // Upstream's 900px stage aligns the particle sphere to a 155px SVG ring.
      setSize(radius * 900 / 155);
    };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches); update();
    preference.addEventListener('change', update);
    return () => { observer.disconnect(); preference.removeEventListener('change', update); };
  }, [persona, activity]);
  const state = activity === 'standby' ? 'idle' : activity;
  return <div ref={container} className={`hud-particle-layer ${!motion || reduced ? 'core-motion-off' : ''}`} aria-hidden="true">
    <div className="hud-particle-fallback" />
    {size > 0 && <div data-apex-stage className="hud-three-stage" style={{ width: 900, height: 900, transform: `translate(-50%,-50%) scale(${size / 900})` }}>
      {innerGlowColor && <div className="hud-core-inner-glow" style={{position:'absolute',left:450,top:450,width:300,height:300,transform:'translate(-50%,-50%)',borderRadius:'50%',pointerEvents:'none',background: `radial-gradient(circle, ${innerGlowColor} 0%, ${innerGlowColor}bb 38%, ${innerGlowColor}66 65%, transparent 100%)`}}/>}
      <div className="hud-upstream-ring" style={{ position: 'absolute', left: 0, top: 190 }}>
        <ApexOrb state={state} variant="frame" onRingClick={undefined} />
      </div>
      {innerGlowColor && <svg className="hud-core-speech-ring" width="900" height="900" viewBox="0 0 900 900" style={{position:'absolute',inset:0,pointerEvents:'none'}}><circle cx="450" cy="450" r="155" fill="none" stroke="#ffffff" strokeWidth="3.5"/></svg>}
      {showParticles && !reduced && <div className="hud-upstream-particles" style={{ position: 'absolute', inset: 0 }}>
        <ApexCore3D state={state} variant="particles" contained onClick={undefined} motion={motion} particleColor={particleColor} secondaryParticleColor={secondaryParticleColor} />
      </div>}
    </div>}
  </div>;
}
