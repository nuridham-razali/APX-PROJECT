export function coreRadius(width: number, height: number, persona: 'APEX' | 'NOVA', activity: string) {
  const base = Math.min(width * .105, height * .145, 110);
  return base * (persona === 'NOVA' && activity !== 'standby' ? 1.5 : 1);
}
