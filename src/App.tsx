import { useCallback, useEffect, useMemo, useState } from 'react';
import gsap from 'gsap';
import { Scene } from './components/Scene';
import { Overlay } from './components/ui/Overlay';
import { Loader } from './components/ui/Loader';
import { MenuPanel } from './components/ui/MenuPanel';
import { CartPanel } from './components/ui/CartPanel';
import { AdminPanel } from './components/ui/AdminPanel';
import { OrderReadyAlert } from './components/ui/OrderReadyAlert';
import { CartProvider } from './store/cart';
import { director } from './lib/director';

function AppInner() {
  const [sceneReady, setSceneReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loaderGone, setLoaderGone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartInitialScreen, setCartInitialScreen] = useState<'cart' | 'confirmed'>('cart');
  const [adminOpen, setAdminOpen] = useState(() => {
    return (
      window.location.pathname === '/admin' ||
      window.location.hash === '#admin' ||
      window.location.search.includes('admin=true')
    );
  });

  const handleReady = useCallback(() => setSceneReady(true), []);

  // Handle /admin routing without page reloads
  useEffect(() => {
    const handleLocation = () => {
      if (
        window.location.pathname === '/admin' ||
        window.location.hash === '#admin' ||
        window.location.search.includes('admin=true')
      ) {
        setAdminOpen(true);
      }
    };

    window.addEventListener('popstate', handleLocation);
    window.addEventListener('hashchange', handleLocation);

    return () => {
      window.removeEventListener('popstate', handleLocation);
      window.removeEventListener('hashchange', handleLocation);
    };
  }, []);

  const handleCloseAdmin = () => {
    setAdminOpen(false);
    if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
      window.history.pushState(null, '', '/');
    }
  };

  // freeze the 3D tree so loader-progress re-renders never touch the canvas
  const scene = useMemo(() => <Scene onReady={handleReady} />, [handleReady]);

  /* Progress: sweeps toward 100 — but only finishes once the 3D scene
     has actually compiled shaders and rendered its first frames. */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      setProgress((p) => {
        const cap = sceneReady ? 100 : 86;
        const rate = sceneReady ? 3.2 : 1.1;
        const next = p + (cap - p) * rate * dt;
        if (sceneReady && next > 99.4) return 100;
        return Math.min(100, next);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sceneReady]);

  /* Master intro timeline — loader out, camera swoop, lid pop, steam burst, UI reveal */
  useEffect(() => {
    if (progress < 100) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fast = reduced ? 0.01 : 1;

    const tl = gsap.timeline();
    tl.to('.loader-inner', { opacity: 0, y: -28, duration: 0.5, ease: 'power2.in' })
      .to('#loader', { yPercent: -100, duration: 1.0, ease: 'power4.inOut' }, '-=0.12')
      .add(() => setLoaderGone(true), '-=0.05')
      .to(director, { camT: 1, duration: 3.8 * fast, ease: 'power3.inOut' }, 0.4)
      .to(director, { spin: 1, duration: 2.6, ease: 'sine.inOut' }, 1.2)
      .to(director, { lidOpen: 1, duration: 1.7 * fast, ease: 'power2.inOut' }, 1.45)
      .add(() => {
        gsap.fromTo(director, { burst: 2.6 }, { burst: 0, duration: 3.0, ease: 'power2.out' });
      }, 1.95)
      .to(director, { lidFloat: 1, duration: 1.8, ease: 'sine.out' }, 3.1)
      .to('.line-inner', { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.1 }, 1.9)
      .to('[data-fade]', { opacity: 1, y: 0, duration: 0.95, ease: 'power3.out', stagger: 0.055 }, 2.2);

    return () => {
      tl.kill();
    };
  }, [progress]);

  const openCart = () => {
    setMenuOpen(false); // close menu first, then open cart
    setCartInitialScreen('cart');
    setCartOpen(true);
  };

  const openTrackOrder = () => {
    setMenuOpen(false);
    setCartInitialScreen('confirmed');
    setCartOpen(true);
  };

  const openAdmin = () => {
    setMenuOpen(false);
    setCartOpen(false);
    setAdminOpen(true);
  };

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#240605]">
      {scene}
      <Overlay onMenuOpen={() => setMenuOpen(true)} onTrackOrder={openTrackOrder} />
      {!loaderGone && <Loader progress={progress} />}
      <div className="grain" aria-hidden />

      {/* Real-time Customer Order Ready Notification popup */}
      <OrderReadyAlert />

      {/* Panels — rendered above everything */}
      {menuOpen && (
        <MenuPanel
          onClose={() => setMenuOpen(false)}
          onOpenCart={openCart}
          onOpenAdmin={openAdmin}
        />
      )}
      {cartOpen && (
        <CartPanel
          initialScreen={cartInitialScreen}
          onClose={() => setCartOpen(false)}
        />
      )}
      {adminOpen && (
        <AdminPanel onClose={handleCloseAdmin} />
      )}
    </main>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppInner />
    </CartProvider>
  );
}
