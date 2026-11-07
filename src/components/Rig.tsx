import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { director, steamUniforms } from '../lib/director';
import { smootherstep } from '../lib/utils3d';
import { useGyro } from '../hooks/useGyro';

/** Cinematic dolly path — from far and high, swooping into the hero pose. */
const CAM_START = new THREE.Vector3(-7.4, 8.6, 18.6);
const CAM_MID = new THREE.Vector3(-3.6, 4.1, 11.6);
const CAM_END = new THREE.Vector3(0.2, 2.3, 8.35);
const FOV_START = 55;
const FOV_END = 35;
const TARGET_START = new THREE.Vector3(0, 2.4, 0);
const TARGET_END = new THREE.Vector3(0.2, 0.78, 0);

export function Rig({ onReady }: { onReady?: () => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gyro = useGyro();

  const bezier = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(CAM_START, CAM_MID, CAM_END);
    return curve;
  }, []);

  const smooth = useRef({ px: 0, py: 0 });
  const prevSmooth = useRef({ px: 0, py: 0 });
  const wind = useRef(new THREE.Vector2(0, 0));
  const basePos = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lookSway = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const spherical = useMemo(() => new THREE.Spherical(), []);
  const frames = useRef(0);

  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime;
    frames.current += 1;
    if (frames.current === 14 && onReady) onReady();

    const k = smootherstep(director.camT);
    bezier.getPoint(k, basePos);
    target.lerpVectors(TARGET_START, TARGET_END, k);

    // pointer + gyro parallax (damped)
    const gx = gyro.current.supported ? gyro.current.x : 0;
    const gy = gyro.current.supported ? gyro.current.y : 0;
    const dpx = pointer.x + gx;
    const dpy = pointer.y + gy;
    smooth.current.px = THREE.MathUtils.damp(smooth.current.px, dpx, 2.6, 1 / 60);
    smooth.current.py = THREE.MathUtils.damp(smooth.current.py, dpy, 2.6, 1 / 60);

    // orbit the base position around the look-target
    offset.copy(basePos).sub(target);
    spherical.setFromVector3(offset);
    spherical.theta += smooth.current.px * 0.17;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - smooth.current.py * 0.075, 0.18, 1.52);

    // gentle idle drift on top
    spherical.theta += Math.sin(t * 0.11) * 0.012;
    spherical.phi += Math.cos(t * 0.13) * 0.006;

    camera.position.setFromSpherical(spherical).add(target);

    // look target sways ever so slightly with the pointer
    lookSway.set(target.x + smooth.current.px * 0.16, target.y + smooth.current.py * 0.1, target.z);
    camera.lookAt(lookSway);

    // fov compression as we swoop in
    const fov = THREE.MathUtils.lerp(FOV_START, FOV_END, k);
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // steam wind: reacts to pointer/gyro velocity
    const vx = (smooth.current.px - prevSmooth.current.px) * 60;
    const vy = (smooth.current.py - prevSmooth.current.py) * 60;
    prevSmooth.current.px = smooth.current.px;
    prevSmooth.current.py = smooth.current.py;
    wind.current.x = THREE.MathUtils.damp(wind.current.x, THREE.MathUtils.clamp(-vx * 0.55, -1.6, 1.6), 2.4, 1 / 60);
    wind.current.y = THREE.MathUtils.damp(wind.current.y, THREE.MathUtils.clamp(vy * 0.4, -1.2, 1.2), 2.4, 1 / 60);
    steamUniforms.uWind.value.copy(wind.current);
  });

  return null;
}
