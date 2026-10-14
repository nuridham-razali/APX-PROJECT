export const NOVA_VISUALS = {
  background: '#020104', cyan: '#24cce2', violet: '#8b5cf6', magenta: '#e040fb', pink: '#ff4fd8', lilac: '#f5e9ff',
  particles: 3200, lowParticles: 1600, stars: 1800, bloom: .65,
  orbitSize: 5.4,

};
export type NovaPhase = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking';
export type NovaSignal = { phase: NovaPhase; inputLevel: number; outputLevel: number; outputTone?: number; preview: boolean };





