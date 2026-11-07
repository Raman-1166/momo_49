import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uPointer;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    vec2 asp = vec2(uAspect, 1.0);

    // warm cinematic gradient — deep red → burnt orange → cream
    vec3 deep   = vec3(0.145, 0.028, 0.022);
    vec3 ember  = vec3(0.62, 0.185, 0.05);
    vec3 cream  = vec3(0.965, 0.835, 0.62);

    vec3 col = mix(cream * 0.42, ember, smoothstep(-0.08, 0.40, uv.y));
    col = mix(col, deep, smoothstep(0.42, 0.98, uv.y));

    // hearth glow behind the steamer
    float d = length((uv - vec2(0.5, 0.40)) * asp * vec2(1.0, 1.15));
    col += vec3(1.0, 0.48, 0.18) * exp(-d * d * 5.2) * 0.5;
    col += vec3(0.9, 0.3, 0.1) * exp(-d * d * 1.6) * 0.22;

    // drifting bokeh — HDR-bright cores so the bloom pass picks them up
    for (int i = 0; i < 15; i++) {
      float fi = float(i);
      vec2 hp = hash2(vec2(fi, fi * 1.7 + 4.2));
      float depth = 0.25 + 0.75 * hash2(vec2(fi, 3.1)).x;
      vec2 p = hp;
      p += vec2(
        sin(uTime * (0.028 + 0.05 * depth) + fi * 2.1),
        cos(uTime * (0.02 + 0.04 * depth) + fi * 1.3)
      ) * 0.06;
      p += uPointer * 0.055 * depth;
      float r = 0.018 + 0.085 * hash2(vec2(fi, 7.7)).x;
      float dd = length((uv - p) * asp);
      float core = smoothstep(r, r * 0.2, dd);
      float halo = smoothstep(r * 2.6, r * 0.2, dd) * 0.28;
      vec3 bc = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.88, 0.66), hash2(vec2(fi, 9.3)).x);
      col += bc * (core * 1.15 + halo) * (0.16 + 0.55 * depth);
    }

    // fine grain
    float g = fract(sin(dot(uv * (900.0 + uTime * 0.0), vec2(12.9898, 78.233)) + uTime * 13.0) * 43758.5453);
    col += (g - 0.5) * 0.035;

    // vignette
    float vg = smoothstep(1.45, 0.35, length((uv - 0.5) * vec2(uAspect * 0.92, 1.22)));
    col *= mix(0.62, 1.0, vg);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Full-viewport cinematic backdrop: warm gradient, drifting bokeh,
 * film grain and vignette — glued to the camera so it always fills
 * the frame, with slight parallax on the bokeh layer.
 */
export function Backdrop() {
  const mesh = useRef<THREE.Mesh>(null!);
  const camera = useThree((s) => s.camera);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    }),
    []
  );

  useFrame(({ clock, pointer, size, viewport }) => {
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uPointer.value.x = THREE.MathUtils.damp(uniforms.uPointer.value.x, pointer.x, 2.5, 0.016);
    uniforms.uPointer.value.y = THREE.MathUtils.damp(uniforms.uPointer.value.y, pointer.y, 2.5, 0.016);

    const DIST = 26;
    camera.getWorldDirection(dir);
    mesh.current.position.copy(camera.position).addScaledVector(dir, DIST);
    mesh.current.quaternion.copy(camera.quaternion);

    const persp = camera as THREE.PerspectiveCamera;
    const h = 2 * DIST * Math.tan(THREE.MathUtils.degToRad((persp.fov ?? 40) / 2)) * 1.03;
    const w = h * (size.width / size.height);
    mesh.current.scale.set(w, h, 1);
    uniforms.uAspect.value = viewport.aspect;
  });

  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
