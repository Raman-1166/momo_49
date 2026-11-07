import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { createChilli, createGarlicGeometry, createGingerGeometry, createLeafGeometry, createSesameGeometry } from '../three/props';
import { mulberry32 } from '../lib/utils3d';

type OrbitCfg = {
  radius: number;
  ecc: number;
  speed: number;
  phase: number;
  baseY: number;
  bobAmp: number;
  bobFreq: number;
  scale: number;
  spin: [number, number, number];
  tilt: [number, number, number];
};

function makeConfigs(count: number, seed: number, base: Partial<OrbitCfg>): OrbitCfg[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    radius: base.radius ?? 2.4 + rnd() * 2.4,
    ecc: 0.78 + rnd() * 0.22,
    speed: (base.speed ?? 0.05 + rnd() * 0.09) * (rnd() > 0.72 ? -1 : 1),
    phase: rnd() * Math.PI * 2,
    baseY: base.baseY ?? 0.4 + rnd() * 2.6,
    bobAmp: 0.08 + rnd() * 0.14,
    bobFreq: 0.4 + rnd() * 0.5,
    scale: (base.scale ?? 1) * (0.85 + rnd() * 0.35),
    spin: [(rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.5],
    tilt: [(rnd() - 0.5) * 1.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.6],
  }));
}

function useOrbiter(
  refs: React.MutableRefObject<(THREE.Object3D | null)[]>,
  cfgs: OrbitCfg[],
  positions: [number, number, number][]
) {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cfgs.forEach((c, i) => {
      const o = refs.current[i];
      if (!o) return;
      const a = t * c.speed + c.phase;
      const [ox, oy, oz] = positions[i % positions.length];
      o.position.set(
        Math.cos(a) * c.radius + ox,
        c.baseY + Math.sin(t * c.bobFreq + c.phase * 2) * c.bobAmp + oy,
        Math.sin(a) * c.radius * c.ecc + oz
      );
      o.rotation.x += c.spin[0] * 0.008;
      o.rotation.y += c.spin[1] * 0.008;
      o.rotation.z += c.spin[2] * 0.008;
    });
  });
}

/**
 * Slow-orbiting mise en place — red chillies, garlic cloves, coriander
 * leaves, ginger coins and a swirl of sesame seeds, all at different
 * depths and speeds for real 3D air around the steamer.
 */
export function Ingredients() {
  const img = useMemo(() => {
    const chilliA = createChilli(5);
    const chilliB = createChilli(12);
    const garlics = [createGarlicGeometry(1), createGarlicGeometry(4), createGarlicGeometry(9)];
    const leaves = [createLeafGeometry(2), createLeafGeometry(8), createLeafGeometry(14)];
    const gingers = [createGingerGeometry(6), createGingerGeometry(11)];
    const sesame = createSesameGeometry();
    return { chilliA, chilliB, garlics, leaves, gingers, sesame };
  }, []);

  const mats = useMemo(
    () => ({
      chilli: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#bb1f1a'),
        roughness: 0.28,
        clearcoat: 0.9,
        clearcoatRoughness: 0.22,
        sheen: 0.4,
        sheenColor: new THREE.Color('#ff9a6a'),
        envMapIntensity: 1.0,
      }),
      stem: new THREE.MeshStandardMaterial({ color: new THREE.Color('#496f26'), roughness: 0.6 }),
      garlic: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#ead9bd'),
        roughness: 0.46,
        sheen: 0.7,
        sheenColor: new THREE.Color('#fff2d6'),
        clearcoat: 0.28,
        clearcoatRoughness: 0.5,
        envMapIntensity: 0.7,
      }),
      leaf: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#3f9142'),
        roughness: 0.52,
        sheen: 0.85,
        sheenColor: new THREE.Color('#c4ffc2'),
        side: THREE.DoubleSide,
        envMapIntensity: 0.55,
      }),
      leaf2: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#2f7c33'),
        roughness: 0.55,
        sheen: 0.8,
        sheenColor: new THREE.Color('#a8f5b0'),
        side: THREE.DoubleSide,
        envMapIntensity: 0.5,
      }),
      ginger: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#e6c98d'),
        roughness: 0.7,
        sheen: 0.5,
        sheenColor: new THREE.Color('#ffedc4'),
        envMapIntensity: 0.45,
      }),
      sesame: new THREE.MeshStandardMaterial({ color: new THREE.Color('#efe2bd'), roughness: 0.48 }),
    }),
    []
  );

  const chilliRefs = useRef<(THREE.Group | null)[]>([]);
  const garlicRefs = useRef<(THREE.Object3D | null)[]>([]);
  const leafRefs = useRef<(THREE.Object3D | null)[]>([]);
  const gingerRefs = useRef<(THREE.Object3D | null)[]>([]);
  const sesameRefs = useRef<(THREE.Object3D | null)[]>([]);

  const chilliCfgs = useMemo(() => makeConfigs(3, 41, { radius: 3.1, speed: 0.075, baseY: 1.6 }), []);
  const garlicCfgs = useMemo(() => makeConfigs(4, 42, { radius: 2.9, speed: 0.1, baseY: 0.9 }), []);
  const leafCfgs = useMemo(() => makeConfigs(6, 43, { radius: 3.6, speed: 0.12, baseY: 1.2 }), []);
  const gingerCfgs = useMemo(() => makeConfigs(3, 44, { radius: 4.3, speed: 0.06, baseY: 2.2 }), []);
  const sesameCfgs = useMemo(() => makeConfigs(12, 45, { radius: 2.5, speed: 0.16, baseY: 1.0, scale: 1 }), []);

  useOrbiter(chilliRefs, chilliCfgs, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  useOrbiter(garlicRefs, garlicCfgs, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  useOrbiter(leafRefs, leafCfgs, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  useOrbiter(gingerRefs, gingerCfgs, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  useOrbiter(sesameRefs, sesameCfgs, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);

  return (
    <group>
      {/* chillies */}
      {chilliCfgs.map((c, i) => (
        <group
          key={`c${i}`}
          ref={(el) => {
            chilliRefs.current[i] = el;
          }}
          scale={c.scale * 1.15}
          rotation={c.tilt}
        >
          <mesh geometry={i % 2 ? img.chilliA.body : img.chilliB.body} material={mats.chilli} castShadow />
          <mesh geometry={i % 2 ? img.chilliA.stem : img.chilliB.stem} material={mats.stem} />
        </group>
      ))}

      {/* garlic cloves */}
      {garlicCfgs.map((c, i) => (
        <mesh
          key={`g${i}`}
          ref={(el) => {
            garlicRefs.current[i] = el;
          }}
          geometry={img.garlics[i % 3]}
          material={mats.garlic}
          scale={c.scale * 1.05}
          rotation={c.tilt}
        />
      ))}

      {/* coriander leaves */}
      {leafCfgs.map((c, i) => (
        <mesh
          key={`l${i}`}
          ref={(el) => {
            leafRefs.current[i] = el;
          }}
          geometry={img.leaves[i % 3]}
          material={i % 2 ? mats.leaf : mats.leaf2}
          scale={c.scale * 0.85}
          rotation={c.tilt}
        />
      ))}

      {/* ginger coins */}
      {gingerCfgs.map((c, i) => (
        <mesh
          key={`n${i}`}
          ref={(el) => {
            gingerRefs.current[i] = el;
          }}
          geometry={img.gingers[i % 2]}
          material={mats.ginger}
          scale={c.scale * 1.25}
          rotation={c.tilt}
        />
      ))}

      {/* sesame swirl */}
      {sesameCfgs.map((c, i) => (
        <mesh
          key={`s${i}`}
          ref={(el) => {
            sesameRefs.current[i] = el;
          }}
          geometry={img.sesame}
          material={mats.sesame}
          rotation={c.tilt}
        />
      ))}
    </group>
  );
}
