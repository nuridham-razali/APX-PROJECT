"use client";

import { Waveform } from './upstream/ApexOrb';

// APEX-UI's original 28 bars, spacing, heights, timing and animation stagger.
export default function HudWaveform({ activity, motion }: {
  activity: 'standby' | 'listening' | 'thinking' | 'speaking'; motion: boolean;
}) {
  const speaking = activity === 'speaking';
  return <div className="hud-github-waveform" data-speaking={speaking} role="img"
    aria-label={`Cyan and gold waveform: ${speaking ? 'speaking animation' : 'resting'}`}>
    <svg width="300" height="48" viewBox="0 0 300 48" aria-hidden="true">
      <line x1="5" y1="24" x2="50" y2="24" stroke="#f5a623" strokeDasharray="4 3" opacity={speaking ? .45 : .15} />
      <line x1="250" y1="24" x2="295" y2="24" stroke="#22d3ee" strokeDasharray="4 3" opacity={speaking ? .45 : .15} />
      <Waveform active={speaking} cx={150} cy={24} width={200} dualColor motion={motion} />
    </svg>
  </div>;
}
