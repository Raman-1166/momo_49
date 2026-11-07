import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { createMomoGeometry } from '../three/momo';
import { doughBumpTexture } from '../lib/textures';
import { director } from '../lib/director';
import { mulberry32 } from '../lib/utils3d';

const CONFIG: { pos: [number, number, number]; s: number; v: number }[] = [
  { pos: [0.0, 0, -0.04], s: 0.7, v: 0 },
  { pos: [0.63, 0, 0.3], s: 0.61, v: 1 },
  { pos: [0.36, 0, -0.56], s: 0.63, v: 2 },
  { pos: [-0.32, 0, -0.6], s: 0.59, v: 0 },
  { pos: [-0.64, 0, 0.24], s: 0.64, v: 1 },
  { pos: [-0.04, 0, 0.64], s: 0.6, v: 2 },
];

/**
 * Six procedurally-pleated momos — three geometry variants × three dough
 * tints, each with its own scale/rotation, gently bobbing in the steam.
 */
export function MomoCluster(props: { position: [number, number, number] }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const rnd = useMemo(() => mulberry32(2024), []);
  const phases = useMemo(() => CONFIG.map(() => rnd() * Math.PI * 2), [rnd]);
  const rots = useMemo(() => CONFIG.map(() => rnd() * Math.PI * 2), [rnd]);

  const geoms = useMemo(
    () => [createMomoGeometry(11), createMomoGeometry(29), createMomoGeometry(53)],
    []
  );

  const materials = useMemo(() => {
    const bump = doughBumpTexture();
    const tints = ['#f6e3c4', '#f9e9cf', '#f0dab6'];
    return tints.map(
      (tint) =>
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(tint),
          roughness: 0.58,
          roughnessMap: bump,
          bumpMap: bump,
          bumpScale: 0.3,
          clearcoat: 0.55,
          clearcoatRoughness: 0.34,
          sheen: 1.0,
          sheenColor: new THREE.Color('#ffd9a3'),
          sheenRoughness: 0.42,
          emissive: new THREE.Color('#3d1f08'),
          emissiveIntensity: 0.055,
          envMapIntensity: 0.85,
        })
    );
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const weight = 0.35 + 0.65 * director.spin;
    meshes.current.forEach((m, i) => {
      if (!m) return;
      const p = phases[i];
      m.position.y = CONFIG[i].pos[1] + Math.sin(t * 1.15 + p) * 0.02 * weight;
      m.rotation.z = Math.sin(t * 0.85 + p * 1.4) * 0.02 * weight;
      m.rotation.x = Math.cos(t * 0.7 + p) * 0.015 * weight;
    });
  });

  return (
    <group position={props.position}>
      {CONFIG.map((cfg, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          geometry={geoms[cfg.v]}
          material={materials[cfg.v]}
          position={cfg.pos}
          rotation={[0, rots[i], 0]}
          scale={cfg.s}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
