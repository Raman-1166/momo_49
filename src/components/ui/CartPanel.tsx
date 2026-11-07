import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import {
  X,
  Trash2,
  ShoppingBag,
  ChevronRight,
  CheckCircle2,
  Minus,
  Plus,
  Clock,
  User,
  Phone,
  AlertCircle,
  Flame,
  Bell,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { MomoMark } from './MomoMark';
import { useCart } from '@/store/cart';
import {
  placeOrder,
  fetchOrderById,
  addItemsToOrder,
  getLatestActiveOrder,
  subscribeToLiveOrders,
  type Order,
} from '@/store/orders';
import { menuCategories } from '@/data/menu';
import { stallConfig } from '@/data/stallConfig';
import { cn } from '@/utils/cn';

const fmt = (n: number) => `₹${n}`;

// ─── Order Success / Real-Time Tracking Screen ────────────────────────────────

function OrderSuccessScreen({
  initialOrder,
  onClose,
  onNewOrder,
}: {
  initialOrder: Order;
  onClose: () => void;
  onNewOrder: () => void;
}) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [copied, setCopied] = useState(false);
  const [showAddItems, setShowAddItems] = useState(false);
  const [addQtyMap, setAddQtyMap] = useState<Record<string, number>>({});
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState('');
  const [addErrorMsg, setAddErrorMsg] = useState('');
  const [remainingMinutes, setRemainingMinutes] = useState<number>(order.estimatedMinutes);

  // Real-time updates via SSE (Server-Sent Events) with automatic fallback polling
  useEffect(() => {
    let es: EventSource | null = null;
    let pollInterval: any = null;

    if (order.id && order.accessToken) {
      try {
        es = new EventSource(`/api/orders/${order.id}/events?token=${encodeURIComponent(order.accessToken)}`);

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.id === order.id) {
              setOrder(data);
            }
          } catch {
            // ignore parse error
          }
        };

        es.onerror = () => {
          es?.close();
        };
      } catch {
        // SSE not supported
      }

      // Polling backup every 6s
      pollInterval = setInterval(async () => {
        const fresh = await fetchOrderById(order.id, order.accessToken);
        if (fresh) setOrder(fresh);
      }, 6000);
    }

    // Real-time Supabase push updates
    const unsubscribeSupabase = subscribeToLiveOrders((updated) => {
      if (updated.id === order.id) {
        setOrder(updated);
      }
    });

    return () => {
      es?.close();
      unsubscribeSupabase();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [order.id, order.accessToken]);

  // Live timer calculation: estimates time remaining based on order creation
  useEffect(() => {
    const updateCountdown = () => {
      const createdTime = new Date(order.createdAt).getTime();
      const elapsedMinutes = Math.floor((Date.now() - createdTime) / 60000);
      const remaining = Math.max(1, order.estimatedMinutes - elapsedMinutes);
      setRemainingMinutes(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);
    return () => clearInterval(interval);
  }, [order.createdAt, order.estimatedMinutes]);

  const copyOrderLink = () => {
    const link = `${window.location.origin}/?order=${order.id}&token=${order.accessToken}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText(stallConfig.upiId).then(() => {
      alert(`UPI ID "${stallConfig.upiId}" copied to clipboard!`);
    });
  };

  // Manage additional items addition
  const handleSetAddQty = (key: string, qty: number) => {
    setAddQtyMap((prev) => {
      const copy = { ...prev };
      if (qty <= 0) {
        delete copy[key];
      } else {
        copy[key] = qty;
      }
      return copy;
    });
  };

  // Calculate subtotal of additional items
  const additionalItemsList = Object.entries(addQtyMap).map(([key, qty]) => {
    const [itemId, variant] = key.split(':');
    let itemPrice = 0;
    let itemName = '';

    for (const cat of menuCategories) {
      const found = cat.items.find((i) => i.id === itemId);
      if (found) {
        itemName = found.name;
        if (variant === '6') itemPrice = found.price6 || 0;
        else if (variant === '10') itemPrice = found.price10 || 0;
        else itemPrice = found.price || 0;
        break;
      }
    }

    return {
      itemId,
      variant: (variant === '6' || variant === '10' ? variant : null) as '6' | '10' | null,
      name: itemName,
      unitPrice: itemPrice,
      qty,
      subtotal: itemPrice * qty,
    };
  });

  const additionalSubtotal = additionalItemsList.reduce((acc, i) => acc + i.subtotal, 0);

  const handleConfirmAddItems = async () => {
    if (additionalItemsList.length === 0) return;
    if (!order.accessToken) return;

    setIsAddingItems(true);
    setAddErrorMsg('');
    setAddSuccessMsg('');

    try {
      const itemsPayload = additionalItemsList.map((i) => ({
        itemId: i.itemId,
        variant: i.variant,
        qty: i.qty,
      }));

      const updated = await addItemsToOrder(order.id, order.accessToken, itemsPayload);
      setOrder(updated);
      setAddQtyMap({});
      setShowAddItems(false);
      setAddSuccessMsg('Extra items added to your order! Kitchen notified.');
      setTimeout(() => setAddSuccessMsg(''), 5000);
    } catch (err: any) {
      setAddErrorMsg(err.message || 'Failed to add items to order');
    } finally {
      setIsAddingItems(false);
    }
  };

  const isUpiPending = order.paymentMethod === 'upi' && order.paymentStatus === 'pending_verification';
  const isPaid = order.paymentStatus === 'paid';

  const orderTimeFormatted = new Date(order.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-6 text-center overflow-y-auto">
      {/* Header Token */}
      <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
        <CheckCircle2 size={28} strokeWidth={2.4} />
      </div>

      <p className="font-display text-2xl italic text-[#f7ead2] md:text-3xl" style={{ fontVariationSettings: "'opsz' 40" }}>
        Live Order Tracker
      </p>
      <p className="font-body text-[11px] tracking-wider text-[#f7ead2]/60 uppercase">
        Digital Token &amp; Kitchen Progress
      </p>

      {addSuccessMsg && (
        <div className="mt-3 w-full max-w-md rounded-xl border border-green-500/50 bg-green-950/60 p-2.5 text-xs text-green-300 font-medium">
          {addSuccessMsg}
        </div>
      )}

      {/* ── 1. TIME & KITCHEN PROGRESS ── */}
      <div className="mt-4 w-full max-w-md rounded-2xl border border-[#ffb15e]/25 bg-[#2d0806]/80 p-4.5 text-left backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between border-b border-[#f7ead2]/12 pb-3">
          <div>
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-[#f7ead2]/50">Order Token</span>
            <p className="font-display text-2xl font-bold text-[#ffb15e]">#{order.orderNumber}</p>
          </div>
          <div className="text-right">
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-[#f7ead2]/50">Estimated Time</span>
            <p className="flex items-center justify-end gap-1 font-body text-sm font-bold text-green-400">
              <Clock size={14} />
              {order.status === 'ready'
                ? 'Ready Now!'
                : order.status === 'completed'
                ? 'Completed'
                : `~${remainingMinutes} Mins Left`}
            </p>
            <span className="text-[10px] text-[#f7ead2]/45">Placed at {orderTimeFormatted}</span>
          </div>
        </div>

        {/* Visual Progress Stepper */}
        <div className="mt-4">
          <div className="grid grid-cols-4 gap-1 text-center font-body text-[10px] uppercase font-bold tracking-wider">
            <span className="text-green-400">1. Placed</span>
            <span className={order.status === 'preparing' || order.status === 'ready' || order.status === 'completed' ? 'text-yellow-400' : 'text-[#f7ead2]/35'}>
              2. Steaming
            </span>
            <span className={order.status === 'ready' || order.status === 'completed' ? 'text-green-400' : 'text-[#f7ead2]/35'}>
              3. Ready
            </span>
            <span className={order.status === 'completed' ? 'text-green-400' : 'text-[#f7ead2]/35'}>
              4. Picked Up
            </span>
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-[#180304] overflow-hidden flex">
            <div className="h-full bg-green-500 w-1/4" />
            <div
              className={cn(
                'h-full transition-all duration-500',
                order.status === 'preparing'
                  ? 'bg-yellow-400 w-1/4 animate-pulse'
                  : order.status === 'ready' || order.status === 'completed'
                  ? 'bg-green-500 w-1/4'
                  : 'bg-transparent w-1/4',
              )}
            />
            <div
              className={cn(
                'h-full transition-all duration-500',
                order.status === 'ready'
                  ? 'bg-green-400 w-1/4 animate-pulse'
                  : order.status === 'completed'
                  ? 'bg-green-500 w-1/4'
                  : 'bg-transparent w-1/4',
              )}
            />
            <div
              className={cn(
                'h-full transition-all duration-500',
                order.status === 'completed' ? 'bg-green-500 w-1/4' : 'bg-transparent w-1/4',
              )}
            />
          </div>
        </div>

        {/* Current Status Message */}
        <div className="mt-3.5">
          {order.status === 'ready' ? (
            <div className="rounded-xl border border-green-500/60 bg-green-950/60 p-3 flex items-center gap-2.5 text-green-200 animate-pulse">
              <Bell size={20} className="text-green-400 shrink-0 animate-bounce" />
              <div>
                <p className="font-body text-xs font-bold uppercase tracking-wider text-green-400">
                  Your Momos are Ready for Pickup! 🔔
                </p>
                <p className="text-[11px] text-green-200/80">
                  Please come to the counter and show Token #{order.orderNumber}.
                </p>
              </div>
            </div>
          ) : order.status === 'completed' ? (
            <div className="rounded-xl border border-green-500/40 bg-[#102915]/80 p-3 flex items-center gap-2.5 text-green-200">
              <Check size={20} className="text-green-400 shrink-0" />
              <div>
                <p className="font-body text-xs font-bold uppercase tracking-wider text-green-400">
                  Order Picked Up &amp; Completed! 🎉
                </p>
                <p className="text-[11px] text-green-200/80">
                  Thank you for dining with us! Hope you enjoyed the delicious hot momos.
                </p>
              </div>
            </div>
          ) : order.status === 'preparing' ? (
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-950/40 p-2.5 flex items-center gap-2 text-yellow-200 text-xs">
              <Flame size={16} className="text-yellow-400 shrink-0 animate-pulse" />
              <span>In the steamer! Hand-pleated and warming in hot bamboo baskets.</span>
            </div>
          ) : isUpiPending ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-2.5 flex items-center gap-2 text-amber-200 text-xs">
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <span>Awaiting payment confirmation. Steamer will start once verified!</span>
            </div>
          ) : (
            <div className="rounded-xl border border-[#ff5d1f]/30 bg-[#180304]/60 p-2.5 flex items-center gap-2 text-[#f7ead2]/70 text-xs">
              <Clock size={15} className="text-[#ffb15e] shrink-0" />
              <span>Ticket received by kitchen. Preparing fresh batch.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. PAYMENT CONDITION & INSTRUCTIONS ── */}
      <div className="mt-3.5 w-full max-w-md rounded-2xl border border-[#f7ead2]/15 bg-[#1f0504]/90 p-4 text-left backdrop-blur-md">
        <p className="font-body text-[10.5px] font-bold tracking-[0.24em] text-[#ffb15e] uppercase">
          Payment Condition
        </p>

        {isUpiPending ? (
          <div className="mt-2 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 uppercase">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                UPI Pending Verification
              </span>
              <span className="font-display text-lg italic text-[#ffb15e]">{fmt(order.totalPrice)}</span>
            </div>

            <p className="text-xs text-[#f7ead2]/80 leading-relaxed">
              Please pay <strong>{fmt(order.totalPrice)}</strong> via GPay, PhonePe, Paytm, or any UPI app to the stall UPI ID below.
              The stall owner will confirm your payment to begin steaming.
            </p>

            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-[#100202] p-2.5">
              <div className="truncate mr-2">
                <span className="block text-[10px] text-[#f7ead2]/50 uppercase">Stall UPI ID</span>
                <span className="font-mono text-xs font-bold text-amber-300">{stallConfig.upiId}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyUpiId}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-colors"
                >
                  Copy ID
                </button>
                <a
                  href={`upi://pay?pa=${stallConfig.upiId}&pn=SteamFold&am=${order.totalPrice}&cu=INR`}
                  className="rounded-lg bg-[#ff5d1f] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#ffb15e] transition-colors flex items-center gap-1"
                >
                  Pay Now <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>
        ) : isPaid ? (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-green-500/40 bg-green-950/40 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-400" />
              <div>
                <p className="text-xs font-bold uppercase text-green-300">Payment Verified &amp; Received</p>
                <p className="text-[11px] text-green-200/70">Payment received via {order.paymentMethod.toUpperCase()}</p>
              </div>
            </div>
            <span className="font-display text-lg italic text-green-300">{fmt(order.totalPrice)}</span>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-950/60 px-2.5 py-0.5 text-[11px] font-bold text-blue-300 uppercase">
                💵 Pay Cash at Counter
              </span>
              <span className="font-display text-lg italic text-[#ffb15e]">{fmt(order.totalPrice)}</span>
            </div>
            <p className="text-xs text-[#f7ead2]/80">
              Please pay <strong>{fmt(order.totalPrice)}</strong> in cash at the counter upon collecting your hot momos.
            </p>
          </div>
        )}
      </div>

      {/* ── 3. ORDERED ITEMS LIST ── */}
      <div className="mt-3.5 w-full max-w-md rounded-2xl border border-[#f7ead2]/15 bg-[#1f0504]/90 p-4 text-left backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-[#f7ead2]/12 pb-2 mb-2">
          <span className="font-body text-[10.5px] font-bold tracking-[0.24em] text-[#ffb15e] uppercase">
            Items in Order ({order.items.length})
          </span>
          <span className="font-display text-sm italic text-[#f7ead2]/70">100% Pure Veg</span>
        </div>

        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs text-[#f7ead2]/85">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>
                  {item.name} {item.variant ? `(${item.variant} pcs)` : ''} × {item.qty}
                </span>
              </div>
              <span className="font-semibold text-[#f7ead2]">{fmt(item.unitPrice * item.qty)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#f7ead2]/12 mt-3 pt-2 font-body">
          <span className="text-xs uppercase tracking-wider text-[#f7ead2]/60">Total Amount</span>
          <span className="font-display text-xl italic text-[#ffb15e]">{fmt(order.totalPrice)}</span>
        </div>
      </div>

      {/* ── 4. ORDER ADD KARNA KA OPTION ("Add More Items to this Order") ── */}
      {order.status !== 'completed' && order.status !== 'cancelled' && (
        <div className="mt-3.5 w-full max-w-md rounded-2xl border border-[#ff5d1f]/40 bg-[#2d0806]/90 p-4 text-left backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowAddItems((v) => !v)}
            className="flex w-full items-center justify-between font-body text-xs font-bold tracking-wider text-[#ffb15e] uppercase hover:text-[#fff6e6] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Plus size={15} className="text-[#ff5d1f]" />
              Add More Items to Order #{order.orderNumber}
            </span>
            {showAddItems ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAddItems && (
            <div className="mt-3.5 space-y-3 pt-3 border-t border-[#f7ead2]/10">
              <p className="text-[11px] text-[#f7ead2]/65">
                Craving extra momos, chutneys, or drinks? Add them to this active ticket before it leaves the steamer:
              </p>

              {addErrorMsg && (
                <p className="rounded-lg bg-red-950/80 border border-red-500/40 p-2 text-xs text-red-300">
                  {addErrorMsg}
                </p>
              )}

              {/* Menu items selection */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {menuCategories.flatMap((cat) => cat.items).map((item) => {
                  const hasVariants = item.price6 !== undefined && item.price10 !== undefined;

                  if (hasVariants) {
                    const key6 = `${item.id}:6`;
                    const key10 = `${item.id}:10`;
                    const qty6 = addQtyMap[key6] || 0;
                    const qty10 = addQtyMap[key10] || 0;

                    return (
                      <div key={item.id} className="rounded-xl border border-[#f7ead2]/10 bg-[#180304]/60 p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-[#f7ead2]">{item.name}</span>
                          <span className="text-[10px] text-green-400 font-bold uppercase">Veg</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[#f7ead2]/60 text-[11px]">6 pcs ({fmt(item.price6!)})</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleSetAddQty(key6, qty6 - 1)}
                                className="h-5 w-5 rounded bg-[#f7ead2]/10 text-center hover:bg-[#ff5d1f]"
                              >
                                -
                              </button>
                              <span className="w-4 text-center font-bold">{qty6}</span>
                              <button
                                onClick={() => handleSetAddQty(key6, qty6 + 1)}
                                className="h-5 w-5 rounded bg-[#f7ead2]/10 text-center hover:bg-[#ff5d1f]"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[#f7ead2]/60 text-[11px]">10 pcs ({fmt(item.price10!)})</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleSetAddQty(key10, qty10 - 1)}
                                className="h-5 w-5 rounded bg-[#f7ead2]/10 text-center hover:bg-[#ff5d1f]"
                              >
                                -
                              </button>
                              <span className="w-4 text-center font-bold">{qty10}</span>
                              <button
                                onClick={() => handleSetAddQty(key10, qty10 + 1)}
                                className="h-5 w-5 rounded bg-[#f7ead2]/10 text-center hover:bg-[#ff5d1f]"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const keyFixed = `${item.id}:`;
                  const qtyFixed = addQtyMap[keyFixed] || 0;

                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#f7ead2]/10 bg-[#180304]/60 p-2.5 text-xs">
                      <div>
                        <span className="font-semibold text-[#f7ead2] block">{item.name}</span>
                        <span className="text-[#ffb15e] text-[11px]">{fmt(item.price!)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSetAddQty(keyFixed, qtyFixed - 1)}
                          className="h-6 w-6 rounded bg-[#f7ead2]/10 text-center hover:bg-[#ff5d1f]"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold">{qtyFixed}</span>
                        <button
                          onClick={() => handleSetAddQty(keyFixed, qtyFixed + 1)}
                          className="h-6 w-6 rounded bg-[#f7ead2]/10 text-center hover:bg-[#ff5d1f]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Summary & Confirm Button */}
              {additionalItemsList.length > 0 && (
                <div className="border-t border-[#f7ead2]/10 pt-2.5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-[#f7ead2]/60">Adding {additionalItemsList.reduce((acc, i) => acc + i.qty, 0)} item(s)</span>
                    <span className="font-bold text-[#ffb15e]">+{fmt(additionalSubtotal)}</span>
                  </div>
                  <button
                    type="button"
                    disabled={isAddingItems}
                    onClick={handleConfirmAddItems}
                    className="w-full rounded-full bg-[#ff5d1f] py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#ffb15e] hover:text-black transition-colors flex items-center justify-center gap-2"
                  >
                    {isAddingItems ? 'Adding to Steamer...' : `Confirm & Add to Order #${order.orderNumber} (+${fmt(additionalSubtotal)})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 5. BOOKMARK / COPY LINK ── */}
      <div className="mt-3.5 flex items-center justify-between w-full max-w-md rounded-xl border border-[#f7ead2]/15 bg-[#180304]/60 px-3.5 py-2 text-xs">
        <span className="text-[11px] text-[#f7ead2]/60 truncate mr-2">
          Save/Bookmark link to track status anytime:
        </span>
        <button
          onClick={copyOrderLink}
          className="flex items-center gap-1 font-bold text-[#ffb15e] hover:text-[#fff6e6] transition-colors shrink-0"
        >
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy Link'}</span>
        </button>
      </div>

      {/* ── 6. ACTIONS ── */}
      <div className="mt-4 flex gap-3 w-full max-w-md">
        <button
          onClick={onNewOrder}
          className="flex-1 rounded-full border border-[#f7ead2]/20 py-2.5 text-xs font-bold tracking-[0.14em] uppercase text-[#f7ead2] transition-colors hover:border-[#ff5d1f] hover:text-[#ff5d1f]"
        >
          Order More Momos
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-full bg-[#ff5d1f] py-2.5 text-xs font-bold tracking-[0.14em] uppercase text-[#fff6e6] transition-colors hover:bg-[#ffb15e] hover:text-[#3a0a06]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Main Cart Panel ──────────────────────────────────────────────────────────

interface CartPanelProps {
  onClose: () => void;
  initialScreen?: 'cart' | 'details' | 'confirmed';
}

export function CartPanel({ onClose, initialScreen = 'cart' }: CartPanelProps) {
  const { items, totalPrice, setQty, remove, clear } = useCart();
  const [screen, setScreen] = useState<'cart' | 'details' | 'confirmed'>(initialScreen);
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash'>('upi');
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const panelRef = useRef<HTMLDivElement>(null);

  // Check URL query parameters or active saved order on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const token = params.get('token');

    if (orderId && token) {
      fetchOrderById(orderId, token).then((ord) => {
        if (ord) {
          setConfirmedOrder(ord);
          setScreen('confirmed');
        }
      });
    } else if (initialScreen === 'confirmed') {
      const active = getLatestActiveOrder();
      if (active) {
        fetchOrderById(active.id, active.accessToken).then((ord) => {
          if (ord) {
            setConfirmedOrder(ord);
            setScreen('confirmed');
          }
        });
      }
    }
  }, [initialScreen]);

  // Slide-in from right
  useEffect(() => {
    if (!panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { x: '100%', opacity: 0.4 },
      { x: '0%', opacity: 1, duration: 0.46, ease: 'power3.out' },
    );
  }, []);

  const handleClose = () => {
    if (!panelRef.current) return;
    gsap.to(panelRef.current, {
      x: '100%',
      opacity: 0,
      duration: 0.34,
      ease: 'power3.in',
      onComplete: onClose,
    });
  };

  const handlePlaceOrder = async () => {
    setErrorMsg('');

    // Strict 10-digit validation
    const digitsOnly = contactNumber.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number (e.g. 9876543210)');
      return;
    }

    setIsSubmitting(true);

    try {
      const newOrder = await placeOrder({
        customerName,
        contactNumber: digitsOnly,
        items,
        paymentMethod,
        hp_bot_check: honeypot,
      });

      clear();
      setConfirmedOrder(newOrder);
      setScreen('confirmed');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place order. Please check inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[60] flex flex-col bg-[#180304]"
      style={{ willChange: 'transform' }}
    >
      {/* Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-[#f7ead2]/10 bg-[#180304]/90 px-5 py-4 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-3">
          <MomoMark size={28} className="text-[#ffb15e]" />
          <div>
            <p className="font-body text-[13px] font-bold tracking-[0.28em] text-[#f7ead2] uppercase">
              {screen === 'confirmed' ? 'Live Order Status' : screen === 'details' ? 'Checkout' : 'Your Plate'}
            </p>
            <p className="font-body text-[10px] tracking-[0.16em] text-[#f7ead2]/50 uppercase">
              {stallConfig.name} • 100% Pure Veg
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="group flex h-9 w-9 items-center justify-center rounded-full border border-[#f7ead2]/15 text-[#f7ead2]/60 transition-colors hover:border-[#ff5d1f]/50 hover:text-[#ff5d1f]"
          aria-label="Close cart"
        >
          <X size={18} />
        </button>
      </header>

      {/* Screen 3: Order Placed & Live Tracking */}
      {screen === 'confirmed' && confirmedOrder ? (
        <OrderSuccessScreen
          initialOrder={confirmedOrder}
          onClose={handleClose}
          onNewOrder={() => setScreen('cart')}
        />
      ) : (
        <>
          {/* Screen 1: Cart Items List */}
          {screen === 'cart' && (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
                <div className="mx-auto max-w-2xl space-y-3">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-[#f7ead2]/40">
                      <ShoppingBag size={48} className="mb-3 opacity-30" />
                      <p className="font-body text-sm font-semibold">Your plate is currently empty</p>
                      <p className="mt-1 text-xs text-[#f7ead2]/30">Add some hot, freshly steamed pure veg momos from the menu.</p>
                      <button
                        onClick={handleClose}
                        className="mt-6 rounded-full border border-[#ff5d1f] px-6 py-2 font-body text-xs font-bold uppercase tracking-wider text-[#ff5d1f] hover:bg-[#ff5d1f] hover:text-white transition-colors"
                      >
                        Browse Pure Veg Menu
                      </button>
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-4 rounded-xl border border-[#f7ead2]/10 bg-[#2d0806]/60 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            <h4 className="font-body text-sm font-semibold text-[#f7ead2] truncate">
                              {item.name}
                            </h4>
                          </div>
                          <span className="text-[11px] text-[#f7ead2]/50">
                            {item.variant ? `${item.variant} pcs • ` : ''}{fmt(item.unitPrice)} each
                          </span>
                        </div>

                        {/* Stepper */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQty(item.key, item.qty - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#f7ead2]/20 text-[#f7ead2]/60 hover:border-[#ff5d1f]/50 hover:text-[#ff5d1f] transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-5 text-center font-body text-sm font-bold text-[#f7ead2]">{item.qty}</span>
                          <button
                            onClick={() => setQty(item.key, item.qty + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#f7ead2]/20 text-[#f7ead2]/60 hover:border-[#ffb15e]/50 hover:text-[#ffb15e] transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <span className="shrink-0 font-display italic text-[#ffb15e] text-base" style={{ fontVariationSettings: "'opsz' 40" }}>
                          {fmt(item.unitPrice * item.qty)}
                        </span>

                        <button
                          onClick={() => remove(item.key)}
                          className="shrink-0 text-[#f7ead2]/25 hover:text-red-400 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sticky bottom */}
              {items.length > 0 && (
                <div className="shrink-0 border-t border-[#f7ead2]/10 bg-[#0d0202]/90 px-5 py-4 backdrop-blur-md md:px-8">
                  <div className="mx-auto max-w-2xl">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-body text-sm text-[#f7ead2]/65">Total</span>
                      <span className="font-display text-2xl italic text-[#ffb15e]" style={{ fontVariationSettings: "'opsz' 40" }}>
                        {fmt(totalPrice)}
                      </span>
                    </div>
                    <button
                      onClick={() => setScreen('details')}
                      className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#ff5d1f] py-3.5 font-body text-[13px] font-bold tracking-[0.18em] text-[#fff6e6] uppercase shadow-[0_8px_32px_-6px_rgba(255,93,31,0.6)] transition-all hover:bg-[#ffb15e] hover:text-[#3a0a06]"
                    >
                      Enter Details &amp; Order
                      <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Screen 2: Customer Details + Payment */}
          {screen === 'details' && (
            <div className="flex flex-1 flex-col justify-between overflow-y-auto px-5 py-6 md:px-8">
              <div className="mx-auto w-full max-w-lg space-y-6">
                {/* Customer Inputs */}
                <div className="rounded-2xl border border-[#f7ead2]/10 bg-[#2d0806]/60 p-5 space-y-4">
                  <p className="font-body text-[11px] font-bold tracking-[0.3em] text-[#ffb15e] uppercase">
                    Customer Information
                  </p>

                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#f7ead2]/70">
                      <User size={13} className="text-[#ffb15e]" /> Customer Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-[#f7ead2]/15 bg-[#180304]/80 px-4 py-2.5 text-sm text-[#f7ead2] placeholder-[#f7ead2]/30 outline-none focus:border-[#ff5d1f]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#f7ead2]/70">
                      <span className="flex items-center gap-2">
                        <Phone size={13} className="text-[#ffb15e]" /> Contact Number *
                      </span>
                      <span className="text-[10.5px] text-[#ffb15e]/70 font-mono">
                        {contactNumber.length}/10 digits
                      </span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number (e.g. 9876543210)"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full rounded-xl border border-[#f7ead2]/15 bg-[#180304]/80 px-4 py-2.5 text-sm text-[#f7ead2] placeholder-[#f7ead2]/30 outline-none focus:border-[#ff5d1f]"
                    />
                    <p className="mt-1 text-[10.5px] text-[#f7ead2]/40">
                      Enter strictly 10 digits for your pickup SMS and order updates.
                    </p>
                  </div>
                </div>

                {/* Payment Option: STRICTLY 2 OPTIONS (UPI or Cash) */}
                <div className="rounded-2xl border border-[#f7ead2]/10 bg-[#2d0806]/60 p-5 space-y-3">
                  <p className="font-body text-[11px] font-bold tracking-[0.3em] text-[#ffb15e] uppercase">
                    Payment Option (Choose UPI or Cash)
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all',
                        paymentMethod === 'upi'
                          ? 'border-[#ff5d1f] bg-[#ff5d1f]/15 text-[#fff6e6] shadow-[0_0_15px_rgba(255,93,31,0.3)]'
                          : 'border-[#f7ead2]/15 bg-[#180304]/60 text-[#f7ead2]/60 hover:border-[#f7ead2]/30',
                      )}
                    >
                      <span className="text-2xl mb-1">📱</span>
                      <span className="font-body text-xs font-bold uppercase tracking-wider">UPI / QR</span>
                      <span className="text-[10px] text-[#ffb15e] mt-0.5 truncate max-w-full px-1">{stallConfig.upiId}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition-all',
                        paymentMethod === 'cash'
                          ? 'border-[#ff5d1f] bg-[#ff5d1f]/15 text-[#fff6e6] shadow-[0_0_15px_rgba(255,93,31,0.3)]'
                          : 'border-[#f7ead2]/15 bg-[#180304]/60 text-[#f7ead2]/60 hover:border-[#f7ead2]/30',
                      )}
                    >
                      <span className="text-2xl mb-1">💵</span>
                      <span className="font-body text-xs font-bold uppercase tracking-wider">Cash on Pickup</span>
                      <span className="text-[10px] text-[#f7ead2]/40 mt-0.5">Pay at Counter</span>
                    </button>
                  </div>
                </div>

                {/* Honeypot field for bot prevention */}
                <div style={{ display: 'none' }} aria-hidden="true">
                  <input
                    type="text"
                    name="hp_bot_check"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {errorMsg && (
                  <p className="rounded-xl bg-red-950/60 border border-red-500/40 p-2.5 text-center text-xs font-medium text-red-300">
                    {errorMsg}
                  </p>
                )}
              </div>

              <div className="mx-auto w-full max-w-lg mt-6 pt-4 border-t border-[#f7ead2]/10">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-body text-sm text-[#f7ead2]/65">Estimated Total</span>
                  <span className="font-display text-2xl italic text-[#ffb15e]">{fmt(totalPrice)}</span>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScreen('cart')}
                    className="flex-1 rounded-full border border-[#f7ead2]/20 py-3.5 font-body text-xs font-bold uppercase tracking-[0.16em] text-[#f7ead2]/70 hover:text-[#f7ead2]"
                  >
                    Back to Plate
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handlePlaceOrder}
                    className="flex-[2] rounded-full bg-[#ff5d1f] py-3.5 font-body text-[13px] font-bold tracking-[0.18em] text-[#fff6e6] uppercase shadow-[0_8px_32px_-6px_rgba(255,93,31,0.6)] transition-all hover:bg-[#ffb15e] hover:text-[#3a0a06]"
                  >
                    {isSubmitting ? 'Placing Order...' : 'Confirm Order'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
