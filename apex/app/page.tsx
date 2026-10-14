import HudPreview from '@/components/HudPreview';
export const dynamic = 'force-dynamic';
export default function Home() {
  const hostedHudOnly=process.env.APEX_DEPLOYMENT_MODE === 'hud-only';
  return <>{hostedHudOnly&&<div className="apex-hosted-notice" role="status">HOSTED HUD · LOCAL BACKEND NOT CONNECTED<span>Chat, voice, memory and tasks run on your PC.</span></div>}<HudPreview hostedHudOnly={hostedHudOnly} /></>;
}
