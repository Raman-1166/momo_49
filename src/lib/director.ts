import * as THREE from 'three';

/**
 * Mutable "director" state — driven by a single GSAP timeline in App.tsx
 * and read every frame by the 3D scene. Plain object on purpose:
 * zero re-renders, butter-smooth 60fps mutation.
 */
export const director = {
  /** 0 = far-away intro pose  →  1 = final hero pose */
  camT: 0,
  /** 0 = lid closed  →  1 = lid open / floating */
  lidOpen: 0,
  /** weight of the lid's idle float once it has settled open */
  lidFloat: 0,
  /** steam burst intensity — spikes when the lid pops */
  burst: 0,
  /** steamer idle-spin weight (ramps in after intro) */
  spin: 0,
};

/** Shared shader uniforms for the steam system (written by Rig + director). */
export const steamUniforms = {
  uTime: { value: 0 },
  uBurst: { value: 0 },
  uWind: { value: new THREE.Vector2(0, 0) },
  uOpacity: { value: 1 },
  uPixelRatio: { value: 1 },
};
