"use client";
import { useEffect, useRef } from 'react';

// Procedural decorative artwork. No remote assets or assistant activity is implied.
export default function GalaxyBackground({ reduced = false, focus = false }: { reduced?: boolean; focus?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const sky = document.createElement('canvas');
    const skyContext = sky.getContext('2d');
    if (!skyContext) return;
    let width = 1, height = 1, frame = 0, last = 0;
    let sparkles: { x: number; y: number; size: number; phase: number }[] = [];
    const randomGenerator = () => {
      let seed = 731940;
      return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    };
    const paintSky = () => {
      const random = randomGenerator();
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth || innerWidth;
      height = canvas.clientHeight || innerHeight;
      canvas.width = sky.width = Math.round(width * dpr);
      canvas.height = sky.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      skyContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      skyContext.fillStyle = '#020610'; skyContext.fillRect(0, 0, width, height);
      const cloud = (x: number, y: number, radius: number, color: string) => {
        const gradient = skyContext.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
        skyContext.fillStyle = gradient; skyContext.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      };
      // A diagonal Milky Way, cyan on one arm and warm gold on the other.
      skyContext.globalCompositeOperation = 'screen';
      for (let i = 0; i < 48; i++) {
        const along = random();
        const x = width * (along * 1.25 - 0.12);
        const y = height * (0.86 - along * 0.76) + (random() - 0.5) * height * 0.16;
        cloud(x, y, height * (0.10 + random() * 0.16), along < 0.56 ? 'rgba(22,160,195,0.055)' : 'rgba(226,166,67,0.065)');
      }
      cloud(width * 0.18, height * 0.18, height * 0.45, 'rgba(10,61,111,0.20)');
      cloud(width * 0.87, height * 0.66, height * 0.36, 'rgba(139,79,24,0.11)');
      skyContext.globalCompositeOperation = 'source-over';
      // Dust lanes add depth without hiding the interface.
      for (let i = 0; i < 15; i++) {
        const along = random();
        cloud(width * along, height * (0.80 - along * 0.70), height * (0.04 + random() * 0.07), 'rgba(0,3,9,0.33)');
      }
      const star = (x: number, y: number, size: number, brightness: number, gold: boolean) => {
        skyContext.fillStyle = gold ? `rgba(255,222,160,${brightness})` : `rgba(194,235,255,${brightness})`;
        skyContext.beginPath(); skyContext.arc(x, y, size, 0, Math.PI * 2); skyContext.fill();
      };
      const count = Math.min(1200, Math.round(width * height / 1000));
      for (let i = 0; i < count; i++) star(random() * width, random() * height, 0.3 + random() * 0.7, 0.20 + random() * 0.58, random() > 0.83);
      for (let i = 0; i < 1600; i++) {
        const along = random();
        const spread = (random() + random() + random() - 1.5) * height * 0.13;
        star(width * (along * 1.25 - 0.12), height * (0.86 - along * 0.76) + spread, 0.18 + random() * 0.48, 0.12 + random() * 0.48, along > 0.60);
      }
      sparkles = Array.from({ length: 38 }, () => ({ x: random() * width, y: random() * height, size: 0.6 + random() * 1.0, phase: random() * Math.PI * 2 }));
    };
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.drawImage(sky, 0, 0, width, height);
      const phase = reduced ? 0 : time / 18000;
      // Thin cyan and gold ribbons sweep slowly through the lower space field.
      const coreY = height * (focus ? width <= 700 ? 0.57 : 0.46 : width <= 700 ? 0.49 : 0.50);
      const coreHeight = focus ? width <= 700 ? width * 0.90 : Math.min(580, width * 0.64) : width <= 700 ? width * 0.65 : Math.min(500, width * 0.48);
      // Occlude only the waves inside the core, keeping the starfield behind it.
      context.save(); context.beginPath(); context.rect(0, 0, width, height);
      context.moveTo(width / 2 + coreHeight * 0.29, coreY);
      context.ellipse(width / 2, coreY, coreHeight * 0.29, coreHeight * 0.30, 0, 0, Math.PI * 2);
      context.clip('evenodd');
      for (const [group, rgb] of [[0, '34,211,238'], [1, '242,204,119']] as const) {
        for (let line = 0; line < 7; line++) {
          const gradient = context.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, `rgba(${rgb},0)`);
          gradient.addColorStop(0.22, `rgba(${rgb},0.40)`);
          gradient.addColorStop(0.66, `rgba(${rgb},0.48)`);
          gradient.addColorStop(1, `rgba(${rgb},0)`);
          context.strokeStyle = gradient; context.lineWidth = line === 3 ? 1.1 : 0.65;
          context.shadowColor = `rgba(${rgb},0.28)`; context.shadowBlur = 10;
          context.beginPath();
          for (let x = 0; x <= width + 16; x += 16) {
            const u = x / width;
            const y = height * ((focus ? width <= 700 ? 0.57 : 0.46 : 0.50) + (group === 0 ? -0.015 : 0.015)) + Math.sin(u * 5.2 + phase + group * 2.8 + line * 0.07) * height * 0.07 + (line - 3) * 7;
            if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
          }
          context.stroke();
        }
      }
      context.restore(); context.shadowBlur = 0;
      for (const star of sparkles) {
        const alpha = reduced ? 0.65 : 0.44 + Math.sin(time / 2700 + star.phase) * 0.21;
        const glow = context.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 5);
        glow.addColorStop(0, `rgba(221,248,255,${alpha})`); glow.addColorStop(1, 'rgba(75,185,231,0)');
        context.fillStyle = glow; context.fillRect(star.x - star.size * 5, star.y - star.size * 5, star.size * 10, star.size * 10);
      }
    };
    const resize = () => { paintSky(); draw(last); };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    resize();
    const animate = (time: number) => { if (time - last >= 33) { last = time; draw(time); } frame = requestAnimationFrame(animate); };
    if (!reduced) frame = requestAnimationFrame(animate);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [reduced, focus]);
  return <canvas ref={canvasRef} className="galaxy-background" aria-hidden="true" />;
}
