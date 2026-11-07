import * as THREE from 'three';
import { mulberry32 } from './utils3d';

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d')! };
}

/* ------------------------------------------------------------------ */
/*  Bamboo weave — vertical slats, dark gaps, stitched binding bands  */
/* ------------------------------------------------------------------ */
export function bambooTexture(repeatX = 1): THREE.CanvasTexture {
  const { c, ctx } = canvas(512);
  const rnd = mulberry32(1234);

  ctx.fillStyle = '#9c6b38';
  ctx.fillRect(0, 0, 512, 512);

  // vertical woven slats
  const slats = 16;
  const w = 512 / slats;
  for (let i = 0; i < slats; i++) {
    const tone = 0.82 + rnd() * 0.3;
    const rC = Math.floor(196 * tone);
    const gC = Math.floor(152 * tone);
    const bC = Math.floor(94 * tone);
    const grad = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    grad.addColorStop(0, `rgb(${rC - 18},${gC - 14},${bC - 10})`);
    grad.addColorStop(0.5, `rgb(${rC},${gC},${bC})`);
    grad.addColorStop(1, `rgb(${rC - 22},${gC - 16},${bC - 12})`);
    ctx.fillStyle = grad;
    ctx.fillRect(i * w, 0, w, 512);
    // gap
    ctx.fillStyle = 'rgba(74,44,20,0.85)';
    ctx.fillRect(i * w - 1.4, 0, 2.8, 512);
  }

  // fine grain streaks
  for (let i = 0; i < 150; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const len = 20 + rnd() * 90;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,230,180,0.07)' : 'rgba(60,34,12,0.09)';
    ctx.lineWidth = 0.8 + rnd() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 4, y + len);
    ctx.stroke();
  }

  // knots
  for (let i = 0; i < 7; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    ctx.fillStyle = 'rgba(84,50,22,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + rnd() * 4, 6 + rnd() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // stitched binding bands
  for (const y of [44, 512 - 72]) {
    ctx.fillStyle = '#7e5023';
    ctx.fillRect(0, y, 512, 30);
    const g2 = ctx.createLinearGradient(0, y, 0, y + 30);
    g2.addColorStop(0, 'rgba(255,214,150,0.28)');
    g2.addColorStop(0.5, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(40,20,6,0.4)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, y, 512, 30);
    // stitches
    ctx.strokeStyle = 'rgba(232,196,138,0.75)';
    ctx.lineWidth = 2.2;
    for (let x = 8; x < 512; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x + 9, y + 24);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Dough bump — flour dusting, soft blotches, micro cracks           */
/* ------------------------------------------------------------------ */
export function doughBumpTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(256);
  const rnd = mulberry32(777);
  ctx.fillStyle = '#7f7f7f';
  ctx.fillRect(0, 0, 256, 256);

  // floury blotches
  for (let i = 0; i < 30; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 10 + rnd() * 42;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rnd() * 0.1;
    g.addColorStop(0, `rgba(205,205,205,${a})`);
    g.addColorStop(1, 'rgba(205,205,205,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // speckle
  for (let i = 0; i < 1400; i++) {
    const v = 100 + Math.floor(rnd() * 90);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.4})`;
    ctx.fillRect(rnd() * 256, rnd() * 256, 1.2, 1.2);
  }

  // faint stretch cracks
  ctx.strokeStyle = 'rgba(70,70,70,0.16)';
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = 0.8 + rnd();
    ctx.beginPath();
    const x = rnd() * 256;
    const y = rnd() * 256;
    ctx.arc(x, y, 14 + rnd() * 30, rnd() * Math.PI, rnd() * Math.PI + 1.1);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Walnut serving board                                               */
/* ------------------------------------------------------------------ */
export function woodTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512);
  const rnd = mulberry32(42);
  ctx.fillStyle = '#71462a';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 110; i++) {
    const y0 = rnd() * 512;
    const amp = 2 + rnd() * 7;
    const freq = 0.004 + rnd() * 0.012;
    const dark = rnd() > 0.42;
    ctx.strokeStyle = dark
      ? `rgba(52,29,12,${0.08 + rnd() * 0.12})`
      : `rgba(146,98,56,${0.06 + rnd() * 0.1})`;
    ctx.lineWidth = 0.8 + rnd() * 2.4;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = y0 + Math.sin(x * freq * Math.PI * 2) * amp + Math.sin(x * 0.02 + i) * 1.4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // knots
  for (let i = 0; i < 3; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    for (let r = 14; r > 2; r -= 3.4) {
      ctx.strokeStyle = `rgba(46,24,10,${0.1 + (14 - r) * 0.02})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Radial alpha fade — lets the studio floor dissolve into the sky    */
/* ------------------------------------------------------------------ */
export function radialFadeTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.62, 'rgba(255,255,255,1)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Chutney surface bump — coarse pepper flakes + tomato bits          */
/* ------------------------------------------------------------------ */
export function chutneyBumpTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(128);
  const rnd = mulberry32(555);
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    const v = 60 + Math.floor(rnd() * 140);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.5 + rnd() * 0.5})`;
    const s = 1 + rnd() * 2.6;
    ctx.fillRect(rnd() * 128, rnd() * 128, s, s);
  }
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = `rgba(50,50,50,${0.25 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.arc(rnd() * 128, rnd() * 128, 2 + rnd() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
