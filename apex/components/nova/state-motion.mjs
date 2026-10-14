// APEX uses one processing animation for both thinking and processing.
export function apexActivity(phase) {
  if (phase === 'processing' || phase === 'thinking') return 'thinking';
  if (phase === 'listening') return 'listening';
  if (phase === 'speaking') return 'speaking';
  return 'standby';
}

const profiles = {
  idle: { speed: .5, swirl: .006, turbulence: .12, gather: 0 },
  listening: { speed: 2, swirl: -.023, turbulence: .3, gather: 1 },
  processing: { speed: 3.2, swirl: .05, turbulence: .8, gather: .3 },
  thinking: { speed: 3.2, swirl: .05, turbulence: .8, gather: .3 },
  speaking: { speed: 2.1, swirl: .025, turbulence: .45, gather: 0 },
};

export function cloudMotion(signal, time = 0) {
  const phase = signal.phase in profiles ? signal.phase : 'idle';
  const profile = profiles[phase];
  const bounded = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const audio = phase === 'speaking' ? bounded(signal.outputLevel) : phase === 'listening' ? bounded(signal.inputLevel) : 0;
  // Sample amplitude is restricted to the explicitly labeled animation preview.
  const level = signal.preview && ['speaking', 'listening'].includes(phase) ? .35 + Math.sin(time * 5) * .18 : audio;
  return { ...profile, speed: profile.speed + level * 2.4, turbulence: profile.turbulence + level * .35, pulse: level, energy: phase === 'idle' ? .07 : .16 + level * .65 };
}
