import { useEffect, useRef } from 'react';

export default function NetworkBackground({ color = 'rgba(1, 102, 114, 0.15)' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const particleCount = 40;
    const connectionDistance = 150;

    // El fundido de las líneas por distancia usaba `color.replace('0.15', ...)`
    // — un literal fijo. Los tres llamadores de este componente pasan alphas
    // distintos (0.1, 0.15, 0.2), así que para cualquiera que no fuera
    // exactamente "0.15" el replace no encontraba nada y la línea se
    // dibujaba siempre a la opacidad base, sin fundido real. Se extrae el
    // alpha real del color recibido en vez de asumir uno fijo.
    const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    const baseAlpha = rgbaMatch ? parseFloat(rgbaMatch[4]) : 0.15;
    const rgbPrefix = rgbaMatch ? `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}` : '1, 102, 114';

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;

      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
      }

      update(w: number, h: number) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > w) this.vx *= -1;
        if (this.y < 0 || this.y > h) this.vy *= -1;
      }

      draw(context: CanvasRenderingContext2D) {
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(canvas.width, canvas.height));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, i) => {
        p.update(canvas.width, canvas.height);
        p.draw(ctx);

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const opacity = 1 - dist / connectionDistance;
            ctx.strokeStyle = `rgba(${rgbPrefix}, ${(baseAlpha * opacity).toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ filter: 'blur(1px)' }}
    />
  );
}
