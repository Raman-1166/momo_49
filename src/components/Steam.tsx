import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { director, steamUniforms } from '../lib/director';
import { mulberry32 } from '../lib/utils3d';

const COUNT = 380;

const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aRadius;
  attribute float aAngle;
  uniform float uTime;
  uniform float uBurst;
  uniform vec2 uWind;
  uniform float uPixelRatio;
  varying float vLife;
  varying float vSeed;

  void main() {
    float speed = 0.62 + 0.75 * fract(aSeed * 7.13);
    float t = fract(uTime * 0.13 * speed * (1.0 + uBurst * 0.55) + aSeed);
    vLife = t;
    vSeed = aSeed;

    // expanding swirl as the steam rises
    float ang = aAngle + uTime * 0.06 + t * (2.0 + aSeed * 1.8);
    float rad = aRadius * (0.35 + t * 0.95) * (1.0 + uBurst * 0.5);

    vec3 pos;
    pos.x = cos(ang) * rad + sin(t * 9.42 + aSeed * 17.0) * 0.22 * t;
    pos.z = sin(ang) * rad + cos(t * 7.53 + aSeed * 23.0) * 0.22 * t;
    pos.y = 0.08 + t * (3.0 + uBurst * 1.6) * (0.85 + 0.3 * fract(aSeed * 5.3));

    // wind / parallax shear — steam leans away from camera motion
    pos.x += uWind.x * t * t * 1.9;
    pos.z += uWind.y * t * t * 1.9;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = mix(26.0, 190.0, t * t) * (0.6 + 0.7 * fract(aSeed * 3.31)) * (1.0 + uBurst * 0.4);
    gl_PointSize = size * uPixelRatio * (5.2 / -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying float vLife;
  varying float vSeed;
  uniform float uOpacity;
  uniform float uBurst;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 3; i++) {
      v += vnoise(p) * amp;
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;

    float circle = smoothstep(1.0, 0.12, d);
    float n = fbm(gl_PointCoord * 3.1 + vSeed * 37.0 + vLife * 2.6);
    float a = circle * (0.28 + 0.72 * n);

    a *= smoothstep(0.0, 0.14, vLife);
    a *= 1.0 - smoothstep(0.5, 1.0, vLife);
    a *= uOpacity * (1.0 + uBurst * 1.35);

    // warm-lit steam, cooler as it climbs
    vec3 col = mix(vec3(1.0, 0.93, 0.84), vec3(0.88, 0.82, 0.78), vLife);
    col += vec3(0.32, 0.14, 0.05) * (1.0 - vLife) * 0.6;

    gl_FragColor = vec4(col, a * 0.5);
  }
`;

export function Steam({ position = [0, 0, 0] as [number, number, number] }) {
  const points = useRef<THREE.Points>(null!);
  const group = useRef<THREE.Group>(null!);

  const geometry = useMemo(() => {
    const rnd = mulberry32(99);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    const radii = new Float32Array(COUNT);
    const angles = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      seeds[i] = rnd();
      radii[i] = Math.sqrt(rnd()) * 0.85;
      angles[i] = rnd() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 8);
    return geo;
  }, []);

  useFrame(({ clock, gl, pointer }) => {
    steamUniforms.uTime.value = clock.elapsedTime;
    steamUniforms.uBurst.value = director.burst;
    steamUniforms.uPixelRatio.value = gl.getPixelRatio();
    // subtle tilt of the whole plume against pointer movement
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, pointer.y * 0.06, 3, 0.016);
      group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, -pointer.x * 0.06, 3, 0.016);
    }
  });

  return (
    <group ref={group} position={position}>
      <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={20}>
        <shaderMaterial
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={steamUniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
    </group>
  );
}
