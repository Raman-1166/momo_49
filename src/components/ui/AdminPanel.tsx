import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  X,
  Bell,
  Clock,
  Phone,
  User,
  ChefHat,
  Flame,
  Check,
  Lock,
  RefreshCw,
  LogOut,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { MomoMark } from './MomoMark';
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
  markAdminPaymentReceived,
  playChime,
  type Order,
  type OrderStatus,
} from '@/store/orders';
import { cn } from '@/utils/cn';

const fmt = (n: number) => `₹${n}`;

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [authed, setAuthed] = useState<boolean>(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'active' | 'ready' | 'all'>('active');
  const panelRef = useRef<HTMLDivElement>(null);

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/admin/check', { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          setAuthed(true);
        }
      })
      .catch(() => setAuthed(false));
  }, []);

  const enableSound = () => {
    playChime(false);
    setAudioEnabled(true);
  };

  // Load orders from server
  const loadOrders = async () => {
    try {
      const liveOrders = await fetchAdminOrders();
      setOrders(liveOrders);
    } catch (err) {
      console.error('Error fetching admin orders:', err);
    }
  };

  useEffect(() => {
    if (!authed) return;
    loadOrders();

    const handleEvent = (e: any) => {
      loadOrders();
      if (e?.detail?.type === 'NEW_ORDER' && audioEnabled) {
        playChime(false);
      }
    };

    window.addEventListener('momo-orders-change', handleEvent);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('momo_orders_channel');
      channel.onmessage = (msg) => {
        loadOrders();
        if (msg?.data?.type === 'NEW_ORDER' && audioEnabled) {
          playChime(false);
        }
      };
    }

    const interval = setInterval(loadOrders, 5000);

    return () => {
      window.removeEventListener('momo-orders-change', handleEvent);
      channel?.close();
      clearInterval(interval);
    };
  }, [authed, audioEnabled]);

  // Entrance animation
  useEffect(() => {
    if (!panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { y: '100%', opacity: 0.3 },
      { y: '0%', opacity: 1, duration: 0.45, ease: 'power3.out' }
    );
  }, []);

  const handleClose = () => {
    if (!panelRef.current) return;
    gsap.to(panelRef.current, {
      y: '100%',
      opacity: 0,
      duration: 0.35,
      ease: 'power3.in',
      onComplete: onClose,
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passInput }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Invalid password' }));
        setPassError(data.error || 'Authentication failed');
        return;
      }

      setAuthed(true);
      setPassInput('');
      setPassError('');
    } catch {
      setPassError('Server unreachable. Please check backend.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuthed(false);
  };

  const setStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateAdminOrderStatus(orderId, status);
      if (status === 'ready' && audioEnabled) {
        playChime(true);
      }
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const markPaymentReceived = async (orderId: string) => {
    try {
      await markAdminPaymentReceived(orderId);
      if (audioEnabled) {
        playChime(true);
      }
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to mark payment received');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'active') return o.status === 'pending' || o.status === 'preparing';
    if (filter === 'ready') return o.status === 'ready';
    return true;
  });

  const activeCount = orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.totalPrice : 0), 0);

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[70] flex flex-col bg-[#140203] text-[#f7ead2]"
      style={{ willChange: 'transform' }}
    >
      {/* Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-[#f7ead2]/10 bg-[#1c0405] px-5 py-4 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-3">
          <ChefHat size={22} className="text-[#ff5d1f]" />
          <div>
            <h2 className="font-body text-sm font-bold tracking-[0.2em] uppercase text-[#f7ead2]">
              Kitchen Admin Panel
            </h2>
            <p className="font-body text-[11px] text-[#f7ead2]/50">
              Hidden Route (/admin) • Live Order &amp; Payment Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {authed && (
            <>
              {/* Audio Enable Button for Browser Autoplay Policy */}
              <button
                onClick={enableSound}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-xs font-bold uppercase transition-all',
                  audioEnabled
                    ? 'bg-green-600/20 text-green-400 border border-green-500/40'
                    : 'bg-[#ff5d1f]/20 text-[#ffb15e] border border-[#ff5d1f]/50 animate-pulse hover:bg-[#ff5d1f]/30'
                )}
                title={audioEnabled ? 'Audio alerts active' : 'Click to enable audio alerts for new orders'}
              >
                <Volume2 size={14} />
                <span className="hidden sm:inline">{audioEnabled ? 'Sound Active' : 'Enable Sound'}</span>
              </button>

              <button
                onClick={loadOrders}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f7ead2]/15 text-[#f7ead2]/60 hover:text-[#ffb15e] transition-colors"
                title="Refresh"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors"
                title="Logout"
              >
                <LogOut size={15} />
              </button>
            </>
          )}
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f7ead2]/15 text-[#f7ead2]/60 hover:text-[#ff5d1f] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Password Gate */}
      {!authed ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-sm rounded-2xl border border-[#f7ead2]/15 bg-[#250607]/80 p-6 backdrop-blur-md shadow-2xl text-center space-y-4"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ff5d1f]/15 text-[#ff5d1f]">
              <Lock size={26} />
            </div>
            <div>
              <h3 className="font-display text-xl italic text-[#f7ead2]">Stall Owner Login</h3>
              <p className="mt-1 font-body text-xs text-[#f7ead2]/50">
                Server-authenticated admin route (/admin)
              </p>
            </div>

            <div>
              <input
                type="password"
                placeholder="Enter admin password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full rounded-xl border border-[#f7ead2]/20 bg-[#140203] px-4 py-2.5 text-sm text-[#f7ead2] placeholder-[#f7ead2]/30 outline-none focus:border-[#ff5d1f]"
              />
              {passError && (
                <p className="mt-2 text-xs text-red-400">{passError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className={cn(
                "w-full rounded-full py-3 text-xs font-bold uppercase tracking-wider text-[#fff6e6] transition-colors",
                isLoggingIn ? "bg-[#ff5d1f]/50 cursor-not-allowed" : "bg-[#ff5d1f] hover:bg-[#ffb15e] hover:text-[#3a0a06]"
              )}
            >
              {isLoggingIn ? "Verifying..." : "Access Dashboard"}
            </button>
          </form>
        </div>
      ) : (
        /* Admin Main View */
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Metrics Row */}
          <div className="shrink-0 border-b border-[#f7ead2]/10 bg-[#190405]/70 px-5 py-3 md:px-8">
            <div className="mx-auto max-w-5xl grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-[#f7ead2]/10 bg-[#250607]/60 p-2.5">
                <span className="block text-[10px] uppercase tracking-wider text-[#f7ead2]/50">Active Orders</span>
                <span className="font-display text-xl font-bold text-[#ffb15e]">{activeCount}</span>
              </div>
              <div className="rounded-xl border border-[#f7ead2]/10 bg-[#250607]/60 p-2.5">
                <span className="block text-[10px] uppercase tracking-wider text-[#f7ead2]/50">Ready for Pickup</span>
                <span className="font-display text-xl font-bold text-green-400">{readyCount}</span>
              </div>
              <div className="rounded-xl border border-[#f7ead2]/10 bg-[#250607]/60 p-2.5">
                <span className="block text-[10px] uppercase tracking-wider text-[#f7ead2]/50">Total Revenue</span>
                <span className="font-display text-xl font-bold text-[#f7ead2]">{fmt(totalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="shrink-0 border-b border-[#f7ead2]/10 px-5 py-3 md:px-8">
            <div className="mx-auto max-w-5xl flex gap-2">
              <button
                onClick={() => setFilter('active')}
                className={cn(
                  'rounded-full px-4 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors',
                  filter === 'active'
                    ? 'bg-[#ff5d1f] text-[#fff6e6]'
                    : 'bg-[#250607] text-[#f7ead2]/60 hover:text-[#f7ead2]'
                )}
              >
                In Kitchen ({activeCount})
              </button>
              <button
                onClick={() => setFilter('ready')}
                className={cn(
                  'rounded-full px-4 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors',
                  filter === 'ready'
                    ? 'bg-green-600 text-[#fff6e6]'
                    : 'bg-[#250607] text-[#f7ead2]/60 hover:text-[#f7ead2]'
                )}
              >
                Ready for Pickup ({readyCount})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'rounded-full px-4 py-1.5 font-body text-xs font-bold uppercase tracking-wider transition-colors',
                  filter === 'all'
                    ? 'bg-[#ffb15e] text-[#3a0a06]'
                    : 'bg-[#250607] text-[#f7ead2]/60 hover:text-[#f7ead2]'
                )}
              >
                All Orders ({orders.length})
              </button>
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8">
            <div className="mx-auto max-w-5xl">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-[#f7ead2]/40">
                  <MomoMark size={50} className="mb-3 opacity-20" />
                  <p className="font-body text-sm">No orders in this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredOrders.map((order) => {
                    const isUpiPending = order.paymentMethod === 'upi' && order.paymentStatus === 'pending_verification';

                    return (
                      <div
                        key={order.id}
                        className={cn(
                          'flex flex-col justify-between rounded-2xl border p-4.5 backdrop-blur-md transition-all',
                          order.status === 'ready'
                            ? 'border-green-500/50 bg-[#102915]/60 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]'
                            : order.status === 'preparing'
                            ? 'border-yellow-500/40 bg-[#291e0a]/60'
                            : isUpiPending
                            ? 'border-amber-500/50 bg-[#2c1d09]/70'
                            : order.status === 'completed'
                            ? 'border-[#f7ead2]/10 bg-[#1c0405]/40 opacity-70'
                            : 'border-[#ff5d1f]/40 bg-[#2d0806]/70'
                        )}
                      >
                        {/* Top Bar of Card */}
                        <div className="flex items-start justify-between border-b border-[#f7ead2]/10 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display text-2xl font-bold text-[#ffb15e]">
                                #{order.orderNumber}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                                  order.status === 'ready'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                    : order.status === 'preparing'
                                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                                    : isUpiPending
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                                    : order.status === 'completed'
                                    ? 'bg-gray-500/20 text-gray-300'
                                    : 'bg-[#ff5d1f]/20 text-[#ffb15e] border border-[#ff5d1f]/40 animate-pulse'
                                )}
                              >
                                {order.status === 'ready'
                                  ? '🔔 READY FOR PICKUP'
                                  : order.status === 'preparing'
                                  ? '🔥 STEAMING'
                                  : isUpiPending
                                  ? '⏳ PAYMENT PENDING'
                                  : order.status === 'completed'
                                  ? 'COMPLETED'
                                  : 'NEW ORDER'}
                              </span>
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-[#f7ead2]/60">
                              <Clock size={12} />
                              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-display text-lg font-bold text-[#ffb15e]">
                              {fmt(order.totalPrice)}
                            </span>
                            <span className="block text-[10px] uppercase font-bold text-[#f7ead2]/45">
                              {order.paymentMethod === 'upi' ? 'UPI / QR' : 'Cash'}{' '}
                              {order.paymentStatus === 'paid' ? '• PAID' : '• UNPAID'}
                            </span>
                          </div>
                        </div>

                        {/* Payment Pending Alert Box */}
                        {isUpiPending && (
                          <div className="my-2 rounded-xl border border-amber-500/40 bg-amber-950/40 p-2.5 flex items-center justify-between text-xs text-amber-200">
                            <span className="flex items-center gap-1.5 font-medium">
                              <AlertCircle size={14} className="text-amber-400 shrink-0" />
                              Customer chose UPI/QR. Verify payment on phone:
                            </span>
                            <button
                              onClick={() => markPaymentReceived(order.id)}
                              className="rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors shrink-0"
                            >
                              Mark Received
                            </button>
                          </div>
                        )}

                        {/* Customer Info */}
                        <div className="py-2.5 border-b border-[#f7ead2]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1.5 font-semibold text-[#f7ead2]">
                            <User size={13} className="text-[#ffb15e]" /> {order.customerName}
                          </span>
                          <a
                            href={`tel:${order.contactNumber}`}
                            className="flex items-center gap-1.5 rounded-full bg-[#180304] px-2.5 py-1 text-xs text-[#ffb15e] hover:underline"
                          >
                            <Phone size={12} /> {order.contactNumber}
                          </a>
                        </div>

                        {/* Items */}
                        <div className="py-3 space-y-1.5 flex-1">
                          {order.items.map((i) => (
                            <div key={i.itemId + (i.variant || '')} className="flex justify-between text-xs">
                              <span className="text-[#f7ead2]/90 font-medium">
                                {i.qty} × {i.name} {i.variant ? `(${i.variant} pcs)` : ''}
                              </span>
                              <span className="text-[#f7ead2]/60">{fmt(i.unitPrice * i.qty)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-3 pt-3 border-t border-[#f7ead2]/10 flex flex-col gap-2">
                          {/* If UPI payment is pending, owner must tap mark received before steaming */}
                          {isUpiPending ? (
                            <button
                              onClick={() => markPaymentReceived(order.id)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black py-2.5 text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
                            >
                              💵 Tap to Confirm UPI Payment Received
                            </button>
                          ) : (
                            order.status === 'pending' && (
                              <button
                                onClick={() => setStatus(order.id, 'preparing')}
                                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-yellow-600/80 hover:bg-yellow-500 text-black py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
                              >
                                <Flame size={14} /> Start Steaming
                              </button>
                            )
                          )}

                          {order.status === 'preparing' && (
                            <button
                              onClick={() => setStatus(order.id, 'ready')}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white py-2.5 text-xs font-bold uppercase tracking-wider shadow-lg shadow-green-900/40 transition-colors animate-pulse"
                            >
                              <Bell size={14} /> Mark Ready &amp; Notify Customer
                            </button>
                          )}

                          {order.status === 'ready' && (
                            <button
                              onClick={() => setStatus(order.id, 'completed')}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#250607] hover:bg-[#35090a] border border-[#f7ead2]/20 text-[#f7ead2] py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                              <Check size={14} /> Handed Over (Complete)
                            </button>
                          )}

                          {order.status !== 'completed' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Cancel order #${order.orderNumber}?`)) {
                                  setStatus(order.id, 'cancelled');
                                }
                              }}
                              className="self-end text-[11px] font-semibold text-red-400/70 hover:text-red-400 transition-colors"
                            >
                              Cancel Order
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
