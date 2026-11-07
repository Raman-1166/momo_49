import * as THREE from 'three';

/** Deterministic PRNG so every momo imperfection is stable between renders. */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cheap layered-trig noise, returns roughly [-1, 1].
 * Used for organic vertex wobble — avoids shipping a noise texture.
 */
export function wobble(x: number, y: number, z: number, seed = 0): number {
  return (
    Math.sin(x * 1.7 + Math.sin(y * 2.1 + seed) * 1.9 + Math.sin(z * 1.3) * 1.2) * 0.5 +
    Math.sin(y * 3.3 + Math.sin(z * 2.7 + x * 1.1) * 1.4 + seed * 0.7) * 0.3 +
    Math.sin(z * 4.7 + Math.sin(x * 3.9 + seed * 1.3) * 1.1) * 0.2
  );
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Ken Perlin's smootherstep — gorgeous for lid / camera easing. */
export const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * Tapered tube along a curve — CatmullRom chillies, garlic stems, etc.
 * radius(t) shapes the profile from base (t=0) to tip (t=1).
 */
export function taperedTube(
  curve: THREE.CatmullRomCurve3,
  segments: number,
  radialSegments: number,
  radius: (t: number) => number
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const P = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radius(t);
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;
      positions.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
      normals.push(nx, ny, nz);
      uvs.push(t, j / radialSegments);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}
