import { useEffect, useRef } from 'react';

/**
 * Phone-tilt parallax source. Normalized to roughly [-1, 1],
 * pre-smoothed. Requests iOS permission on first touch if needed.
 */
export function useGyro() {
  const gyro = useRef({ x: 0, y: 0, supported: false });

  useEffect(() => {
    const target = { x: 0, y: 0 };
    let raf = 0;
    let listening = false;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.x = Math.max(-1, Math.min(1, e.gamma / 32));
      target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 32));
      gyro.current.supported = true;
    };

    const tick = () => {
      gyro.current.x += (target.x - gyro.current.x) * 0.06;
      gyro.current.y += (target.y - gyro.current.y) * 0.06;
      raf = requestAnimationFrame(tick);
    };

    const attach = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
      raf = requestAnimationFrame(tick);
    };

    const unlock = async () => {
      try {
        const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
        if (typeof DOE.requestPermission === 'function') {
          const res = await DOE.requestPermission();
          if (res === 'granted') attach();
        } else {
          attach();
        }
      } catch {
        attach();
      }
    };

    // Android / permissive browsers can attach immediately
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== 'function') {
      attach();
    }
    window.addEventListener('touchstart', unlock, { once: true, passive: true });

    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      cancelAnimationFrame(raf);
    };
  }, []);

  return gyro;
}
