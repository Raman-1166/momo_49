import { useMemo } from 'react';
import * as THREE from 'three';
import { chutneyBumpTexture } from '../lib/textures';
import { createGingerGeometry, createLeafGeometry, createSesameGeometry } from '../three/props';

/**
 * Hammered-copper chutney bowl with glossy fire-roasted tomato chutney,
 * a coriander garnish — plus scattered ginger coins and leaves on the board.
 */
export function Chutney({ position = [0, 0, 0] as [number, number, number] }) {
  const copperMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#b96427'),
        metalness: 1,
        roughness: 0.32,
        clearcoat: 0.5,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide,
      }),
    []
  );

  const chutneyMat = useMemo(() => {
    const bump = chutneyBumpTexture();
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c03a10'),
      roughness: 0.16,
      bumpMap: bump,
      bumpScale: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.4,
      sheenColor: new THREE.Color('#ff8a50'),
      emissive: new THREE.Color('#521100'),
      emissiveIntensity: 0.18,
      envMapIntensity: 1.0,
    });
  }, []);

  const leafMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#3f9142'),
        roughness: 0.5,
        sheen: 0.8,
        sheenColor: new THREE.Color('#baffc0'),
        side: THREE.DoubleSide,
        envMapIntensity: 0.5,
      }),
    []
  );

  const bowlProfile = useMemo(() => {
    const pts = [
      [0.001, 0.01],
      [0.16, 0.012],
      [0.3, 0.05],
      [0.42, 0.14],
      [0.475, 0.26],
      [0.49, 0.34],
      [0.462, 0.335],
      [0.44, 0.27],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(24), 56);
  }, []);

  const leaf = useMemo(() => createLeafGeometry(7), []);
  const sesame = useMemo(() => createSesameGeometry(), []);

  return (
    <group position={position}>
      <mesh geometry={bowlProfile} material={copperMat} castShadow receiveShadow />
      {/* chutney surface — slight meniscus dome */}
      <mesh material={chutneyMat} position={[0, 0.245, 0]} receiveShadow>
        <sphereGeometry args={[0.4, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.24]} />
      </mesh>
      <mesh material={chutneyMat} position={[0, 0.243, 0]}>
        <cylinderGeometry args={[0.398, 0.4, 0.012, 48]} />
      </mesh>
      {/* coriander garnish on top */}
      <mesh
        geometry={leaf}
        material={leafMat}
        position={[0.05, 0.315, 0.05]}
        rotation={[-Math.PI / 2 + 0.25, 0.7, 0]}
        scale={0.5}
        castShadow
      />
      {/* sesame sprinkles */}
      {[
        [-0.12, 0.31, 0.1],
        [0.14, 0.305, -0.08],
        [-0.02, 0.312, -0.16],
      ].map((p, i) => (
        <mesh
          key={i}
          geometry={sesame}
          position={p as [number, number, number]}
          rotation={[1.2, i * 2.1, 0.4]}
        >
          <meshStandardMaterial color="#f0e3bd" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Static garnish resting on the board near the bowl. */
export function BoardGarnish() {
  const ginger = useMemo(() => [createGingerGeometry(3), createGingerGeometry(9)], []);
  const leaf1 = useMemo(() => createLeafGeometry(21), []);
  const leaf2 = useMemo(() => createLeafGeometry(33), []);

  const gingerMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#e3c186'),
        roughness: 0.72,
        sheen: 0.5,
        sheenColor: new THREE.Color('#ffe9bb'),
        envMapIntensity: 0.4,
      }),
    []
  );
  const leafMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#35853a'),
        roughness: 0.55,
        sheen: 0.7,
        sheenColor: new THREE.Color('#baffc0'),
        side: THREE.DoubleSide,
        envMapIntensity: 0.45,
      }),
    []
  );

  return (
    <group>
      <mesh geometry={ginger[0]} material={gingerMat} position={[-1.35, 0.028, 1.6]} rotation={[0.12, 1.2, -0.1]} scale={1.15} castShadow />
      <mesh geometry={ginger[1]} material={gingerMat} position={[-1.02, 0.03, 1.84]} rotation={[-0.06, 2.6, 0.14]} castShadow />
      <mesh geometry={leaf1} material={leafMat} position={[-0.5, 0.02, 1.48]} rotation={[-Math.PI / 2 + 0.18, 0.4, 0]} castShadow />
      <mesh geometry={leaf2} material={leafMat} position={[2.35, 0.02, 1.3]} rotation={[-Math.PI / 2 + 0.22, 2.1, 0]} scale={0.85} castShadow />
    </group>
  );
}
