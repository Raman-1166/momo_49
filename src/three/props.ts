import * as THREE from 'three';
import { mulberry32, taperedTube, wobble } from '../lib/utils3d';

/* ------------------------------------------------------------------ */
/*  Red chilli — gently hooked tapered body + green stem               */
/* ------------------------------------------------------------------ */
export function createChilli(seed: number): { body: THREE.BufferGeometry; stem: THREE.BufferGeometry } {
  const rnd = mulberry32(seed);
  const bend = 0.55 + rnd() * 0.5;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.16, -0.015 - rnd() * 0.03, 0.03),
    new THREE.Vector3(0.34, -0.05 - bend * 0.1, 0.045),
    new THREE.Vector3(0.5, -0.16 - bend * 0.22, 0.02),
    new THREE.Vector3(0.585, -0.32 - bend * 0.3, -0.03),
  ]);
  const body = taperedTube(curve, 30, 12, (t) => {
    const taper = Math.pow(1 - t * 0.92, 0.72);
    const shoulder = 1 + 0.32 * Math.exp(-Math.pow((t - 0.1) / 0.16, 2));
    return 0.082 * taper * shoulder + 0.004;
  });

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.01, 0),
    new THREE.Vector3(-0.045, 0.09, 0.01),
    new THREE.Vector3(-0.1, 0.16, 0.03),
    new THREE.Vector3(-0.17, 0.2, 0.02),
  ]);
  const stem = taperedTube(stemCurve, 10, 7, (t) => 0.026 * (1 - t * 0.72) + 0.004);

  return { body, stem };
}

/* ------------------------------------------------------------------ */
/*  Garlic clove — teardrop lathe with longitudinal ridges             */
/* ------------------------------------------------------------------ */
export function createGarlicGeometry(seed: number): THREE.BufferGeometry {
  const profile = [
    [0.001, 0.004],
    [0.075, 0.004],
    [0.125, 0.03],
    [0.15, 0.09],
    [0.148, 0.16],
    [0.12, 0.235],
    [0.075, 0.3],
    [0.03, 0.345],
    [0.001, 0.365],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(20), 40);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const theta = Math.atan2(v.z, v.x);
    const h = v.y / 0.365;
    const r = Math.hypot(v.x, v.z);
    if (r > 0.003) {
      const ridge = 1 + 0.055 * Math.cos(theta * 7 + seed) * THREE.MathUtils.smoothstep(h, 0.08, 0.72);
      const n = 1 + wobble(v.x * 5, v.y * 5, v.z * 5, seed) * 0.02;
      const nr = r * ridge * n;
      // gentle crescent bend
      const bendAmt = 0.08 * THREE.MathUtils.smoothstep(h, 0.3, 1);
      pos.setXYZ(i, Math.cos(theta) * nr + bendAmt, v.y, Math.sin(theta) * nr * 0.92);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/*  Coriander leaf — scalloped fan silhouette, cupped like a real one  */
/* ------------------------------------------------------------------ */
export function createLeafGeometry(seed: number): THREE.BufferGeometry {
  const rnd = mulberry32(seed);
  const R = 0.42 * (0.9 + rnd() * 0.2);
  const lobes = 6;

  const shape = new THREE.Shape();
  shape.moveTo(0, -0.06);
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const a = (-62 + (124 * i) / steps) * (Math.PI / 180);
    const scallop = 0.86 + 0.14 * Math.abs(Math.cos((a / (Math.PI / 180)) * (Math.PI / (62 / (lobes / 2)))));
    const r = R * scallop * (1 - Math.abs(a) * 0.22);
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) shape.lineTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.lineTo(0, -0.06);

  const geo = new THREE.ShapeGeometry(shape, 10);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // cup upward + ripply edges
    const cup = 0.5 * x * x + 0.16 * Math.sin(x * 12 + seed) * Math.abs(x);
    const flutter = wobble(x * 4, y * 4, 0, seed) * 0.02;
    pos.setZ(i, cup + flutter);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/*  Ginger coin — irregular rim, soft dents                            */
/* ------------------------------------------------------------------ */
export function createGingerGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.17, 0.155, 0.05, 28, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const theta = Math.atan2(v.z, v.x);
    const rim = 1 + 0.13 * wobble(Math.cos(theta) * 2, Math.sin(theta) * 2, seed, seed);
    const dent = wobble(v.x * 8, v.y * 8, v.z * 8, seed * 2) * 0.008;
    pos.setXYZ(i, v.x * rim, v.y + dent, v.z * rim);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/*  Sesame seed — tiny teardrop                                        */
/* ------------------------------------------------------------------ */
export function createSesameGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.05, 12, 9);
  geo.scale(1, 0.55, 0.74);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) pos.setX(i, pos.getX(i) * (1 - y * 1.1));
  }
  geo.computeVertexNormals();
  return geo;
}
