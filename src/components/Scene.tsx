import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Backdrop } from './Backdrop';
import { Rig } from './Rig';
import { Steamer } from './Steamer';
import { Chutney, BoardGarnish } from './Chutney';
import { Ingredients } from './Ingredients';
import { Steam } from './Steam';
import { woodTexture, radialFadeTexture } from '../lib/textures';

export const STEAMER_POS: [number, number, number] = [0.7, 0.02, -0.18];

function Board() {
  const wood = useMemo(() => woodTexture(), []);
  const topMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: wood,
        bumpMap: wood,
        bumpScale: 0.3,
        roughness: 0.52,
        clearcoat: 0.4,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.6,
      }),
    [wood]
  );
  const sideMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#3f2412'),
        roughness: 0.6,
        clearcoat: 0.3,
        envMapIntensity: 0.4,
      }),
    []
  );
  return (
    <mesh position={[0, -0.13, 0]} receiveShadow castShadow material={[sideMat, topMat, sideMat]}>
      <cylinderGeometry args={[3.05, 3.0, 0.26, 80]} />
    </mesh>
  );
}

function Floor() {
  const fade = useMemo(() => radialFadeTexture(), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]} receiveShadow>
      <circleGeometry args={[24, 64]} />
      <meshStandardMaterial
        color="#d9b287"
        roughness={0.96}
        metalness={0}
        alphaMap={fade}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export function Scene({ onReady }: { onReady?: () => void }) {
  return (
    <Canvas
      flat
      shadows
      dpr={[1, 1.8]}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        alpha: false,
      }}
      camera={{ fov: 55, near: 0.1, far: 80, position: [-7.4, 8.6, 18.6] }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <color attach="background" args={['#240605']} />
      <fog attach="fog" args={['#57150a', 14, 32]} />

      <Suspense fallback={null}>
        {/* local HDRI room — warm strips for clearcoat glints, no network fetch */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={['#170402']} />
          <Lightformer intensity={3.4} position={[0, 4, 0.5]} scale={[7, 3, 1]} color="#ff9e57" />
          <Lightformer intensity={1.4} position={[-4, 1.4, -1]} rotation={[0, Math.PI / 2, 0]} scale={[5, 2.2, 1]} color="#ffd9ac" />
          <Lightformer intensity={1.0} position={[4, 2.2, -0.5]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 2.6, 1]} color="#ff6a2a" />
          <Lightformer intensity={0.7} position={[0, 1.8, 5]} scale={[6, 1.6, 1]} color="#fff1da" />
        </Environment>

        <Backdrop />
        <Rig onReady={onReady} />

        {/* lighting */}
        <ambientLight intensity={0.22} color="#ffd7b0" />
        <directionalLight
          castShadow
          position={[4.2, 8, 3.2]}
          intensity={3.1}
          color="#ffb46b"
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.025}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-camera-near={2}
          shadow-camera-far={24}
        />
        <directionalLight position={[-6, 3.4, -4.5]} intensity={0.55} color="#5d7bff" />
        <pointLight position={[-0.4, 0.6, 2.6]} intensity={5.5} distance={7} decay={2} color="#ff8a3d" />

        <Floor />
        <Board />
        <Steamer position={STEAMER_POS} />
        <Chutney position={[-2.2, 0.01, 1.15]} />
        <BoardGarnish />
        <Steam position={[STEAMER_POS[0], 0.9, STEAMER_POS[2]]} />
        <Ingredients />

        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.85} luminanceSmoothing={0.32} />
          <Vignette eskil={false} offset={0.22} darkness={0.6} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
