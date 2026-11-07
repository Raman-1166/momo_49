import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { bambooTexture } from '../lib/textures';
import { director } from '../lib/director';
import { smootherstep } from '../lib/utils3d';
import { MomoCluster } from './Momo';

/** Lid poses (local to the steamer group). */
const LID_CLOSED = { p: new THREE.Vector3(0, 1.03, 0), e: new THREE.Euler(0.015, 0.3, -0.02) };
const LID_OPEN = { p: new THREE.Vector3(1.35, 2.55, -1.0), e: new THREE.Euler(0.3, 0.6, -0.44) };

/**
 * Bamboo steamer — woven wall, stitched bands, woven floor, slate plate,
 * six momos, and the lid that lifts open during the intro.
 */
export function Steamer({ position = [0, 0, 0] as [number, number, number] }) {
  const spinGroup = useRef<THREE.Group>(null!);
  const lid = useRef<THREE.Group>(null!);
  const angle = useRef(0);
  const spinOffset = useRef(0);
  const tmpE = useMemo(() => new THREE.Euler(), []);

  const bamboo = useMemo(() => bambooTexture(3), []);
  const bambooLid = useMemo(() => bambooTexture(2), []);

  const wallMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: bamboo,
        bumpMap: bamboo,
        bumpScale: 0.18,
        roughness: 0.62,
        clearcoat: 0.22,
        clearcoatRoughness: 0.5,
        side: THREE.DoubleSide,
        envMapIntensity: 0.5,
      }),
    [bamboo]
  );
  const bandMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#7c4f24'),
        roughness: 0.55,
        envMapIntensity: 0.4,
      }),
    []
  );
  const plateMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#22292a'),
        roughness: 0.26,
        clearcoat: 0.75,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.9,
      }),
    []
  );
  const lidMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: bambooLid,
        bumpMap: bambooLid,
        bumpScale: 0.2,
        roughness: 0.6,
        clearcoat: 0.2,
        side: THREE.DoubleSide,
        envMapIntensity: 0.55,
      }),
    [bambooLid]
  );

  const lidProfile = useMemo(() => {
    // ordered outer-rim → crown so lathe normals face outward/up
    const pts = [
      [1.74, -0.02],
      [1.66, 0.035],
      [1.45, 0.082],
      [1.1, 0.128],
      [0.7, 0.16],
      [0.3, 0.178],
      [0.001, 0.185],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(26), 72);
  }, []);

  useFrame(({ clock, pointer }, delta) => {
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // slow idle rotation + pointer-reactive nudge
    angle.current += dt * 0.16 * director.spin;
    spinOffset.current = THREE.MathUtils.damp(spinOffset.current, pointer.x * 0.22, 2.2, dt);
    if (spinGroup.current) spinGroup.current.rotation.y = angle.current + spinOffset.current;

    // lid: closed → open with a floaty settle
    if (lid.current) {
      const k = smootherstep(director.lidOpen);
      const lf = director.lidFloat;
      lid.current.position.lerpVectors(LID_CLOSED.p, LID_OPEN.p, k);
      lid.current.position.y += Math.sin(t * 0.85) * 0.055 * lf;
      tmpE.set(
        THREE.MathUtils.lerp(LID_CLOSED.e.x, LID_OPEN.e.x, k) + Math.sin(t * 0.7) * 0.035 * lf,
        THREE.MathUtils.lerp(LID_CLOSED.e.y, LID_OPEN.e.y, k) + Math.sin(t * 0.5) * 0.05 * lf,
        THREE.MathUtils.lerp(LID_CLOSED.e.z, LID_OPEN.e.z, k) + Math.cos(t * 0.62) * 0.035 * lf
      );
      lid.current.rotation.copy(tmpE);
    }
  });

  return (
    <group position={position}>
      {/* spinning contents */}
      <group ref={spinGroup}>
        {/* woven wall */}
        <mesh material={wallMat} position={[0, 0.535, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.62, 1.68, 0.95, 72, 1, true]} />
        </mesh>
        {/* rim bands */}
        <mesh material={bandMat} position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[1.65, 0.055, 14, 72]} />
        </mesh>
        <mesh material={bandMat} position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.66, 0.038, 12, 72]} />
        </mesh>
        <mesh material={bandMat} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.68, 0.05, 12, 72]} />
        </mesh>
        {/* woven floor */}
        <mesh material={wallMat} position={[0, 0.1, 0]} receiveShadow>
          <cylinderGeometry args={[1.6, 1.56, 0.08, 72]} />
        </mesh>
        {/* slate plate */}
        <mesh material={plateMat} position={[0, 0.175, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[1.3, 1.22, 0.075, 64]} />
        </mesh>
        <MomoCluster position={[0, 0.215, 0]} />
      </group>

      {/* lid (independent of the spin) */}
      <group ref={lid} position={LID_CLOSED.p.toArray()}>
        <mesh geometry={lidProfile} material={lidMat} castShadow receiveShadow />
        {/* inner lip */}
        <mesh material={bandMat} position={[0, -0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.56, 0.045, 12, 64]} />
        </mesh>
        {/* handle */}
        <mesh material={lidMat} position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.13, 0.11, 24]} />
        </mesh>
        <mesh material={bandMat} position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.028, 10, 32]} />
        </mesh>
      </group>
    </group>
  );
}
