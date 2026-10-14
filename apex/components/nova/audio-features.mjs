// Loudness envelope and spectral brightness, not emotion or pitch detection.
export function voiceFeatures(samples, spectrum, sampleRate, fftSize, previous = {level: 0, tone: 0}, delta = 1 / 60) {
  let power = 0;
  for (const value of samples) power += ((value - 128) / 128) ** 2;
  const rms = Math.sqrt(power / Math.max(1, samples.length));
  const target = Math.min(1, Math.max(0, (rms - .008) * 5));
  const dt = Math.max(0, Math.min(.1, delta));
  const level = previous.level + (target - previous.level) * (1 - Math.exp(-dt / (target > previous.level ? .025 : .1)));
  let energy = 0, weighted = 0;
  for (let i = 1; i < spectrum.length; i++) {
    const hz = i * sampleRate / fftSize;
    if (hz < 80 || hz > 4000) continue;
    const magnitude = (spectrum[i] / 255) ** 2;
    energy += magnitude;
    weighted += magnitude * hz;
  }
  const toneTarget = target > .01 && energy > .001 ? Math.max(0, Math.min(1, (weighted / energy - 150) / 3000)) : 0;
  const tone = previous.tone + (toneTarget - previous.tone) * (1 - Math.exp(-dt / .08));
  return {level, tone};
}
