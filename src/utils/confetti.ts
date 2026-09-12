/**
 * Lightweight canvas confetti celebration generator
 */
export function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const colors = [
    '#d4af37', // metallic gold
    '#e5c158', // champagne gold
    '#b38b4d', // bronze
    '#f5e6c8', // cream gold
    '#9b2c2c', // deep wine
    '#2c5282', // navy blue
    '#38a169', // sage green
    '#e28743'  // warm terracotta
  ];

  interface Particle {
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    vy: number;
    rotation: number;
    vRotation: number;
    color: string;
    opacity: number;
    shape: 'rect' | 'circle' | 'star';
  }

  const particles: Particle[] = [];
  const particleCount = 140;

  for (let i = 0; i < particleCount; i++) {
    // Launch from bottom-middle or top edges
    const launchFromSide = Math.random() > 0.5;
    particles.push({
      x: launchFromSide ? (Math.random() < 0.5 ? width * 0.15 : width * 0.85) : width * 0.5,
      y: height * 0.7,
      w: Math.random() * 8 + 6,
      h: Math.random() * 12 + 8,
      vx: (Math.random() - 0.5) * 18,
      vy: -(Math.random() * 16 + 12),
      rotation: Math.random() * 360,
      vRotation: (Math.random() - 0.5) * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1,
      shape: Math.random() > 0.8 ? 'circle' : 'rect'
    });
  }

  let animationFrameId: number;
  const gravity = 0.45;
  const drag = 0.98;

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    let activeParticles = 0;

    for (const p of particles) {
      p.vy += gravity;
      p.vx *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRotation;

      if (p.y > height * 0.3) {
        p.opacity -= 0.008;
      }

      if (p.opacity > 0 && p.y < height + 50) {
        activeParticles++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
    }

    if (activeParticles > 0) {
      animationFrameId = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrameId);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  render();
}
