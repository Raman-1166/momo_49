import { useLayoutEffect, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { MomoMark } from './MomoMark';
import { getLatestActiveOrder, type MyOrderRef } from '@/store/orders';

interface OverlayProps {
  onMenuOpen: () => void;
  onTrackOrder?: () => void;
}

/**
 * Editorial hero chrome — Apple-style typography framing the 3D scene.
 * Elements start hidden; the master GSAP timeline in App reveals them.
 */
export function Overlay({ onMenuOpen, onTrackOrder }: OverlayProps) {
  const [activeOrder, setActiveOrder] = useState<MyOrderRef | null>(() => getLatestActiveOrder());

  useEffect(() => {
    const handleOrderChange = () => {
      setActiveOrder(getLatestActiveOrder());
    };

    window.addEventListener('momo-orders-change', handleOrderChange);
    window.addEventListener('storage', handleOrderChange);

    return () => {
      window.removeEventListener('momo-orders-change', handleOrderChange);
      window.removeEventListener('storage', handleOrderChange);
    };
  }, []);

  useLayoutEffect(() => {
    gsap.set('.line-inner', { yPercent: 115 });
    gsap.set('[data-fade]', { opacity: 0, y: 26 });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none">
      {/* legibility scrims */}
      <div className="absolute inset-x-0 bottom-0 h-[52vh] bg-[linear-gradient(to_top,rgba(26,4,2,0.78)_0%,rgba(26,4,2,0.28)_45%,rgba(26,4,2,0)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(to_bottom,rgba(26,4,2,0.55),rgba(26,4,2,0))]" />

      {/* ── Navbar: logo left · MENU centre · ORDER right ── */}
      <header className="absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-center px-6 pt-6 md:px-10 md:pt-7">
        {/* left — logo */}
        <a href="#" data-fade className="pointer-events-auto flex items-center gap-3 text-[#f7ead2]">
          <MomoMark size={34} className="text-[#ffb15e]" />
          <span className="font-body text-[13px] font-bold tracking-[0.34em] uppercase">
            Steam <span className="text-[#ffb15e]">&amp;</span> Fold
          </span>
        </a>

        {/* centre — MENU (visible on all breakpoints) */}
        <nav className="flex justify-center">
          <button
            onClick={onMenuOpen}
            data-fade
            className="group pointer-events-auto font-body text-[12.5px] font-semibold tracking-[0.22em] text-[#f7ead2]/75 uppercase transition-colors hover:text-[#f7ead2]"
          >
            Menu
            <span className="mt-1 block h-px w-0 bg-[#ffb15e] transition-all duration-300 group-hover:w-full" />
          </button>
        </nav>

        {/* right — TRACK ACTIVE ORDER + ORDER button */}
        <div className="flex justify-end items-center gap-2.5">
          {activeOrder && (
            <button
              onClick={onTrackOrder}
              data-fade
              className="group pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#ff5d1f] bg-[#ff5d1f]/15 px-3 py-1.5 font-body text-[11px] font-bold tracking-[0.14em] text-[#ffb15e] uppercase transition-all hover:bg-[#ff5d1f] hover:text-[#fff6e6] shadow-[0_0_15px_rgba(255,93,31,0.3)] animate-pulse"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <span>Track #{activeOrder.orderNumber}</span>
            </button>
          )}

          <button
            onClick={onMenuOpen}
            data-fade
            className="group pointer-events-auto flex items-center gap-2 rounded-full bg-[#f7ead2] px-5 py-2.5 font-body text-[12px] font-bold tracking-[0.18em] text-[#3a0a06] uppercase transition-colors hover:bg-[#ffb15e]"
          >
            Order
            <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:rotate-45" />
          </button>
        </div>
      </header>

      {/* headline — top left */}
      <div className="absolute top-[16vh] left-6 max-w-[13em] md:top-[18vh] md:left-10">
        <p
          data-fade
          className="mb-5 flex items-center gap-3 font-body text-[11px] font-semibold tracking-[0.4em] text-[#ffb15e] uppercase"
        >
          <span className="inline-block h-px w-10 bg-[#ffb15e]/70" />
          Himalayan momo atelier — est. 2014
        </p>
        <h1
          className="font-display text-[#f7ead2]"
          style={{
            fontSize: 'clamp(2.9rem, 7.2vw, 6.8rem)',
            lineHeight: 0.98,
            fontWeight: 480,
            fontVariationSettings: "'opsz' 144",
            letterSpacing: '-0.015em',
          }}
        >
          <span className="block overflow-hidden pb-1">
            <span className="line-inner block">Pleated by hand,</span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span className="line-inner block">
              kissed by <em className="text-[#ffb15e]">steam.</em>
            </span>
          </span>
        </h1>
      </div>

      {/* sub + CTAs — bottom left */}
      <div className="absolute bottom-[13vh] left-6 md:bottom-[12.5vh] md:left-10">
        <p data-fade className="mb-7 max-w-[24rem] font-body text-[13.5px] leading-relaxed text-[#f7ead2]/72 md:text-sm">
          Eleven folds. One bamboo steamer. Eight minutes over roaring steam.
          Hand-pleated momos served with fire-roasted tomato-sesame chutney.
        </p>
        <div data-fade className="flex flex-wrap items-center gap-4">
          <button
            onClick={onMenuOpen}
            className="group pointer-events-auto flex items-center gap-3 rounded-full bg-[#ff5d1f] py-3.5 pr-6 pl-7 font-body text-[12.5px] font-bold tracking-[0.16em] text-[#fff6e6] uppercase shadow-[0_10px_40px_-8px_rgba(255,93,31,0.65)] transition-all duration-300 hover:bg-[#ffb15e] hover:text-[#3a0a06]"
          >
            Order steaming now
            <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1.5" />
          </button>
          <button
            onClick={onMenuOpen}
            className="group pointer-events-auto flex items-center gap-2 border-b border-[#f7ead2]/30 pb-1 font-body text-[12.5px] font-semibold tracking-[0.16em] text-[#f7ead2]/85 uppercase transition-colors hover:border-[#ffb15e] hover:text-[#ffb15e]"
          >
            The menu
            <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:rotate-45" />
          </button>
        </div>
      </div>

      {/* stats — right bottom */}
      <div className="absolute right-6 bottom-[12.5vh] hidden text-right md:right-10 lg:block">
        {[
          ['62k+', 'momos folded weekly'],
          ['11', 'pleats on every piece'],
          ['8 min', 'bamboo steam, to order'],
        ].map(([n, l]) => (
          <div data-fade key={l} className="mb-4 last:mb-0">
            <p className="font-display text-2xl italic text-[#f7ead2]">{n}</p>
            <p className="font-body text-[10.5px] tracking-[0.22em] text-[#f7ead2]/55 uppercase">{l}</p>
          </div>
        ))}
      </div>

      {/* marquee — bottom edge */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-[#f7ead2]/12 bg-[#1c0403]/35 backdrop-blur-[3px]">
        <div className="marquee-track flex w-max items-center gap-0 py-3">
          {[0, 1].map((half) => (
            <div key={half} className="flex items-center" aria-hidden={half === 1}>
              {['Steamed to order', 'Hand-pleated at dawn', 'Fire-roasted chutney', 'Small-batch bamboo baskets', 'Momo of the week — jhol buff'].map((txt) => (
                <span key={txt} className="flex items-center gap-6 pr-6 font-body text-[11px] font-semibold tracking-[0.3em] whitespace-nowrap text-[#f7ead2]/60 uppercase">
                  {txt}
                  <MomoMark size={15} className="text-[#ffb15e]/80" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
