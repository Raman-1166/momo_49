import { useState, useMemo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { X, Search, MapPin, Phone, Clock, Plus, Minus, ShoppingBag } from 'lucide-react';
import { MomoMark } from './MomoMark';
import { menuCategories, addOns, type MenuItem } from '@/data/menu';
import { stallConfig } from '@/data/stallConfig';
import { useCart, type CartItem } from '@/store/cart';
import { cn } from '@/utils/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n}`;

function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-[1.5px]',
        isVeg ? 'border-green-500' : 'border-red-500',
      )}
      title={isVeg ? 'Veg' : 'Non-veg'}
      aria-label={isVeg ? 'Veg' : 'Non-veg'}
    >
      <span className={cn('h-2 w-2 rounded-full', isVeg ? 'bg-green-500' : 'bg-red-500')} />
    </span>
  );
}

// ─── Single menu card ─────────────────────────────────────────────────────────

function MenuCard({ item }: { item: MenuItem }) {
  const { items, add, setQty } = useCart();
  const hasVariants = item.price6 !== undefined && item.price10 !== undefined;
  const [variant, setVariant] = useState<'6' | '10'>('6');

  const unitPrice = hasVariants
    ? variant === '6' ? item.price6! : item.price10!
    : item.price!;

  const cartKey = hasVariants ? `${item.id}-${variant}` : item.id;
  const cartItem = items.find((i) => i.key === cartKey);
  const qty = cartItem?.qty ?? 0;

  const handleAdd = () => {
    const payload: Omit<CartItem, 'qty'> = {
      key: cartKey,
      itemId: item.id,
      name: item.name,
      variant: hasVariants ? variant : null,
      unitPrice,
      isVeg: item.isVeg,
    };
    add(payload);
  };

  return (
    <div className={cn(
      'flex flex-col gap-2.5 rounded-xl border px-4 py-3.5 backdrop-blur-sm transition-colors',
      qty > 0
        ? 'border-[#ff5d1f]/40 bg-[#3a0a06]/70'
        : 'border-[#f7ead2]/10 bg-[#2d0806]/60 hover:border-[#ffb15e]/30 hover:bg-[#3a0a06]/70',
    )}>
      {/* Row 1: name + price */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <VegDot isVeg={item.isVeg} />
          <span className="font-body text-[13.5px] font-semibold leading-snug text-[#f7ead2] truncate">
            {item.name}
          </span>
        </div>
        <span
          className="shrink-0 font-display text-lg italic text-[#ffb15e]"
          style={{ fontVariationSettings: "'opsz' 40" }}
        >
          {fmt(unitPrice)}
        </span>
      </div>

      {/* Row 2: variant pills (if any) + add/remove control */}
      <div className="flex items-center justify-between gap-3">
        {/* Variant selector */}
        {hasVariants ? (
          <div className="flex gap-1.5">
            {(['6', '10'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={cn(
                  'rounded-full px-3 py-0.5 font-body text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors',
                  variant === v
                    ? 'bg-[#ff5d1f] text-[#fff6e6]'
                    : 'border border-[#f7ead2]/20 text-[#f7ead2]/55 hover:border-[#ffb15e]/50 hover:text-[#f7ead2]/80',
                )}
              >
                {v} pcs
              </button>
            ))}
          </div>
        ) : (
          <span /> /* spacer */
        )}

        {/* Add / Stepper */}
        {qty === 0 ? (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 rounded-full border border-[#ff5d1f]/60 bg-[#ff5d1f]/10 px-4 py-1 font-body text-[12px] font-bold tracking-[0.14em] text-[#ff5d1f] uppercase transition-colors hover:bg-[#ff5d1f] hover:text-[#fff6e6]"
          >
            <Plus size={12} />
            Add
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(cartKey, qty - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#f7ead2]/20 text-[#f7ead2]/60 hover:border-[#ff5d1f]/50 hover:text-[#ff5d1f] transition-colors"
            >
              <Minus size={12} />
            </button>
            <span className="w-5 text-center font-body text-sm font-bold text-[#f7ead2]">{qty}</span>
            <button
              onClick={handleAdd}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#f7ead2]/20 text-[#f7ead2]/60 hover:border-[#ffb15e]/50 hover:text-[#ffb15e] transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  categoryId,
  search,
}: {
  categoryId: string;
  search: string;
}) {
  const cat = menuCategories.find((c) => c.id === categoryId);
  if (!cat) return null;

  const filtered = useMemo(() => {
    return cat.items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [cat.items, search]);

  if (filtered.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h3
          className="font-display text-xl italic text-[#f7ead2]"
          style={{ fontVariationSettings: "'opsz' 40" }}
        >
          {cat.label}
        </h3>
        {cat.note && (
          <span className="font-body text-[11px] tracking-[0.2em] text-[#f7ead2]/45 uppercase">
            {cat.note}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {filtered.map((item) => (
          <MenuCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

// ─── Floating cart bar ────────────────────────────────────────────────────────

function CartBar({ onOpenCart }: { onOpenCart: () => void }) {
  const { totalQty, totalPrice } = useCart();
  const barRef = useRef<HTMLDivElement>(null);

  // Animate in/out when qty changes
  useEffect(() => {
    if (!barRef.current) return;
    if (totalQty > 0) {
      gsap.to(barRef.current, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
    } else {
      gsap.to(barRef.current, { y: 80, opacity: 0, duration: 0.25, ease: 'power3.in' });
    }
  }, [totalQty > 0]);                   // only fire on empty↔non-empty transition

  return (
    <div
      ref={barRef}
      style={{ transform: 'translateY(80px)', opacity: 0 }}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 px-5 pb-5 md:px-8"
    >
      <button
        onClick={onOpenCart}
        className="group flex w-full items-center justify-between rounded-2xl bg-[#ff5d1f] px-5 py-3.5 shadow-[0_8px_40px_-6px_rgba(255,93,31,0.7)] transition-all hover:bg-[#ffb15e]"
      >
        {/* left: bag icon + item count */}
        <div className="flex items-center gap-3">
          <span className="relative">
            <ShoppingBag size={20} className="text-[#fff6e6]" />
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#fff6e6] font-body text-[10px] font-bold text-[#ff5d1f]">
              {totalQty}
            </span>
          </span>
          <span className="font-body text-[12.5px] font-bold tracking-[0.14em] text-[#fff6e6] uppercase group-hover:text-[#3a0a06] transition-colors">
            View Cart
          </span>
        </div>
        {/* right: total */}
        <span className="font-display text-lg italic text-[#fff6e6] group-hover:text-[#3a0a06] transition-colors" style={{ fontVariationSettings: "'opsz' 40" }}>
          {fmt(totalPrice)}
        </span>
      </button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface MenuPanelProps {
  onClose: () => void;
  onOpenCart: () => void;
  onOpenAdmin?: () => void;
}

export function MenuPanel({ onClose, onOpenCart, onOpenAdmin }: MenuPanelProps) {
  const [activeTab, setActiveTab] = useState(menuCategories[0].id);
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Slide-in on mount
  useEffect(() => {
    if (!panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { x: '100%', opacity: 0.4 },
      { x: '0%', opacity: 1, duration: 0.52, ease: 'power3.out' },
    );
  }, []);

  const handleClose = () => {
    if (!panelRef.current) return;
    gsap.to(panelRef.current, {
      x: '100%', opacity: 0, duration: 0.38, ease: 'power3.in', onComplete: onClose,
    });
  };

  // Scroll content to top when tab changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeTab]);

  // Reset to first tab when searching
  useEffect(() => {
    if (search) setActiveTab('all');
  }, [search]);

  const isSearching = search.trim().length > 0;

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#180304]"
      style={{ willChange: 'transform' }}
    >
      {/* Top gradient scrim */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#0d0202] to-transparent z-10" />

      {/* ── Header ── */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-[#f7ead2]/10 bg-[#180304]/90 px-5 py-4 backdrop-blur-md md:px-8 md:py-5">
        <div className="flex items-center gap-3">
          <MomoMark size={30} className="text-[#ffb15e]" />
          <div>
            <p className="font-body text-[13px] font-bold tracking-[0.28em] text-[#f7ead2] uppercase">
              {stallConfig.name}
            </p>
            <p className="font-body text-[10.5px] tracking-[0.18em] text-[#f7ead2]/50 uppercase">
              {stallConfig.tagline}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#f7ead2]/15 text-[#f7ead2]/60 transition-colors hover:border-[#ff5d1f]/50 hover:text-[#ff5d1f]"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </header>

      {/* ── Search + veg filter ── */}
      <div className="relative z-20 shrink-0 border-b border-[#f7ead2]/10 bg-[#180304]/80 px-5 py-3 backdrop-blur-md md:px-8">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#f7ead2]/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search momos…"
              className="w-full rounded-full border border-[#f7ead2]/12 bg-[#2d0806]/60 py-2 pr-4 pl-9 font-body text-[13px] text-[#f7ead2] placeholder:text-[#f7ead2]/30 outline-none focus:border-[#ffb15e]/50 focus:ring-0"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-green-500/40 bg-green-950/40 px-3.5 py-1.5 font-body text-[11px] font-bold tracking-[0.14em] text-green-400 uppercase">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            100% Pure Veg
          </div>
        </div>
      </div>

      {/* ── Category tabs ── */}
      {!isSearching && (
        <div className="relative z-20 shrink-0 overflow-x-auto border-b border-[#f7ead2]/10 bg-[#180304]/80 px-4 backdrop-blur-md md:px-8 scrollbar-none">
          <div className="flex gap-1 py-2">
            {menuCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={cn(
                  'whitespace-nowrap rounded-full px-4 py-1.5 font-body text-[12px] font-semibold tracking-[0.16em] uppercase transition-colors',
                  activeTab === cat.id
                    ? 'bg-[#ff5d1f] text-[#fff6e6]'
                    : 'text-[#f7ead2]/55 hover:text-[#f7ead2]/80',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Scrollable content — extra bottom padding so cart bar doesn't cover last item ── */}
      <div
        ref={contentRef}
        className="relative z-10 flex-1 overflow-y-auto px-5 py-6 pb-28 md:px-8 md:py-8 md:pb-28"
      >
        <div className="mx-auto max-w-2xl">
          {isSearching ? (
            <div className="flex flex-col gap-8">
              {menuCategories.map((cat) => (
                <CategorySection key={cat.id} categoryId={cat.id} search={search} />
              ))}
              {menuCategories.every((cat) =>
                cat.items.every(
                  (item) => !item.name.toLowerCase().includes(search.toLowerCase()),
                ),
              ) && (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  <MomoMark size={48} className="text-[#f7ead2]/20" />
                  <p className="font-body text-sm text-[#f7ead2]/40">
                    No momos found for &ldquo;{search}&rdquo;
                  </p>
                </div>
              )}
            </div>
          ) : (
            <CategorySection key={activeTab} categoryId={activeTab} search="" />
          )}

          {/* Add-ons strip */}
          {!isSearching && (
            <div className="mt-10 rounded-xl border border-[#f7ead2]/10 bg-[#2d0806]/40 px-5 py-4">
              <p className="mb-3 font-body text-[11px] font-semibold tracking-[0.3em] text-[#ffb15e] uppercase">
                Add-ons available
              </p>
              <div className="flex flex-wrap gap-2">
                {addOns.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#f7ead2]/12 px-3 py-1 font-body text-[12px] text-[#f7ead2]/65"
                  >
                    {a.label}
                    <span className="text-[#ffb15e]">{a.priceNote}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-2 font-body text-[11px] text-[#f7ead2]/60">
              <span className="h-2 w-2 rounded-full bg-green-500" /> 100% Pure Vegetarian Kitchen
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-20 shrink-0 border-t border-[#f7ead2]/10 bg-[#0d0202]/90 px-5 py-4 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-1.5">
          <a
            href={stallConfig.mapsUrl}
            className="flex items-center gap-2 font-body text-[11.5px] text-[#f7ead2]/55 transition-colors hover:text-[#ffb15e]"
          >
            <MapPin size={12} className="shrink-0 text-[#ffb15e]" />
            {stallConfig.location}
          </a>
          <a
            href={`tel:${stallConfig.phone.replace(/\s/g, '')}`}
            className="flex items-center gap-2 font-body text-[11.5px] text-[#f7ead2]/55 transition-colors hover:text-[#ffb15e]"
          >
            <Phone size={12} className="shrink-0 text-[#ffb15e]" />
            {stallConfig.phone}
          </a>
          <span className="flex items-center gap-2 font-body text-[11.5px] text-[#f7ead2]/55">
            <Clock size={12} className="shrink-0 text-[#ffb15e]" />
            {stallConfig.timings}
          </span>
          <button
            onClick={() => {
              onClose();
              if (onOpenAdmin) onOpenAdmin();
              else window.location.hash = 'admin';
            }}
            className="flex items-center gap-1.5 font-body text-[11px] text-[#f7ead2]/30 transition-colors hover:text-[#ffb15e]"
          >
            🔒 Kitchen Portal
          </button>
        </div>
      </footer>

      {/* ── Floating cart bar (above footer) ── */}
      <CartBar onOpenCart={onOpenCart} />
    </div>
  );
}
