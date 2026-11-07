import * as THREE from 'three';
import { mulberry32, wobble } from '../lib/utils3d';

export const MOMO_HEIGHT = 0.92;

/**
 * Procedural momo.
 *
 * A plump lathe profile gets hand-pleated folds via angular vertex
 * displacement that grows toward the crown, spirals with height
 * (like a real thumb-and-finger fold), twists shut at the top knot,
 * and receives per-seed organic imperfections so no two momos match.
 */
export function createMomoGeometry(seed: number): THREE.BufferGeometry {
  const rnd = mulberry32(seed * 7919 + 17);

  const pleats = 10 + Math.floor(rnd() * 4);          // 10-13 folds
  const pleatAmp = 0.062 + rnd() * 0.034;             // fold depth
  const swirl = 2.4 + rnd() * 1.8;                    // spiral of the folds
  const phase = rnd() * Math.PI * 2;
  const lean = (rnd() - 0.5) * 0.9;                   // slight hand-made lean
  const leanDir = rnd() * Math.PI * 2;

  // Plump bottom → gathered crown profile
  const profile = [
    [0.001, 0.015],
    [0.2, 0.012],
    [0.36, 0.026],
    [0.47, 0.07],
    [0.515, 0.155],
    [0.512, 0.26],
    [0.478, 0.375],
    [0.42, 0.49],
    [0.34, 0.59],
    [0.25, 0.675],
    [0.16, 0.745],
    [0.09, 0.805],
    [0.048, 0.852],
    [0.02, 0.886],
    [0.001, 0.912],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const spline = new THREE.SplineCurve(profile);
  const pts = spline
    .getPoints(34)
    .map((v) => new THREE.Vector2(Math.max(v.x, 0.0012), THREE.MathUtils.clamp(v.y, 0.012, MOMO_HEIGHT)));

  const geo = new THREE.LatheGeometry(pts, 120);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const theta = Math.atan2(v.z, v.x);
    const h = THREE.MathUtils.clamp(v.y / MOMO_HEIGHT, 0, 1);
    const r = Math.hypot(v.x, v.z);

    let nx = v.x;
    let ny = v.y;
    let nz = v.z;

    if (r > 0.004) {
      // fold mask — belly stays smooth, crown gets pleated
      const mask = THREE.MathUtils.smoothstep(h, 0.32, 0.9);
      // irregular hand-made rhythm: some folds deeper than others
      const rhythm = 1 + 0.38 * Math.sin(theta * 3 + phase) * mask + 0.2 * Math.sin(theta * 5 + phase * 2.7) * mask;
      const fold = Math.cos(theta * pleats - swirl * (h - 0.32) * 3.4 + phase);
      const dr = r * pleatAmp * rhythm * mask * fold;

      // gather + pinch toward the crown
      const pinch = 1 - 0.2 * Math.pow(mask, 2.2);
      let nr = (r + dr * 2.5) * pinch;

      // organic surface micro-wobble
      const n = wobble(v.x * 3.2 + seed * 3.7, v.y * 3.2, v.z * 3.2, seed);
      nr *= 1 + n * 0.011 * (0.35 + 0.65 * (1 - h));

      // twist the top knot shut
      const twist = 0.55 * THREE.MathUtils.smoothstep(h, 0.68, 1) * (swirl / 4);
      const ct = Math.cos(twist);
      const st = Math.sin(twist);
      const px = Math.cos(theta) * nr;
      const pz = Math.sin(theta) * nr;
      nx = px * ct - pz * st;
      nz = px * st + pz * ct;

      // subtle hand-shaped lean + fold-height wobble
      nx += Math.cos(leanDir) * lean * 0.05 * h * h;
      nz += Math.sin(leanDir) * lean * 0.05 * h * h;
      ny += dr * 0.35 + n * 0.005 * mask;
    }

    pos.setXYZ(i, nx, ny, nz);
  }

  geo.computeVertexNormals();
  return geo;
}
