import { useEffect, useState } from 'react';
import { MomoMark } from './MomoMark';

const LINES = ['Warming the bamboo steamers', 'Folding eleven pleats', 'Whisking the fire chutney', 'Dusting the flour'];

export function Loader({ progress }: { progress: number }) {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setLine((l) => (l + 1) % LINES.length), 700);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      id="loader"
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 65%, #57130b 0%, #2b0705 55%, #180304 100%)',
      }}
    >
      <div className="loader-inner flex flex-col items-center gap-7">
        <div className="momo-breathe text-[#ffb15e]">
          <MomoMark size={92} steam />
        </div>
        <div className="text-center">
          <p className="font-body text-[11px] font-semibold tracking-[0.55em] text-[#f7ead2]/70 uppercase">
            Steam &amp; Fold
          </p>
          <p className="font-display mt-3 text-xl italic text-[#f7ead2]" style={{ fontVariationSettings: "'opsz' 40" }}>
            {LINES[line]}
            <span className="ellipsis" />
          </p>
        </div>
        <div className="h-px w-44 overflow-hidden bg-[#f7ead2]/15">
          <div
            className="h-full bg-gradient-to-r from-[#ff5d1f] to-[#ffb15e] transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="font-display pointer-events-none absolute right-6 bottom-5 text-6xl italic text-[#f7ead2]/25 md:right-10 md:bottom-8 md:text-8xl">
        {Math.round(progress)}
      </div>
    </div>
  );
}
