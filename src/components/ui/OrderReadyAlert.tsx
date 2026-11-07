import { useEffect, useState } from 'react';
import { Bell, X, Sparkles, Check } from 'lucide-react';
import {
  getMyOrderRefs,
  fetchOrderById,
  subscribeToLiveOrders,
  playChime,
  type Order,
} from '@/store/orders';

const DISMISSED_ORDERS_KEY = 'momo_dismissed_ready_orders';

function getDismissedOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markOrderDismissed(id: string) {
  try {
    const existing = getDismissedOrderIds();
    if (!existing.includes(id)) {
      localStorage.setItem(DISMISSED_ORDERS_KEY, JSON.stringify([...existing, id]));
    }
  } catch {}
}

export function OrderReadyAlert() {
  const [readyOrder, setReadyOrder] = useState<Order | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkMyOrders = async () => {
      const myRefs = getMyOrderRefs();
      if (!myRefs.length) return;

      const dismissed = getDismissedOrderIds();

      // Check the latest active orders
      for (const ref of myRefs.slice(0, 5)) {
        // If already received or dismissed by customer, skip
        if (dismissed.includes(ref.id)) continue;

        const order = await fetchOrderById(ref.id, ref.accessToken);
        if (!isMounted || !order) continue;

        // If order was already completed or cancelled, do not alert
        if (order.status === 'completed' || order.status === 'cancelled') {
          markOrderDismissed(order.id);
          setReadyOrder((prev) => (prev?.id === order.id ? null : prev));
          continue;
        }

        // Trigger alert only if order is actively ready
        if (order.status === 'ready') {
          setReadyOrder((prev) => {
            if (!prev || prev.id !== order.id) {
              playChime(true);
            }
            return order;
          });
          break;
        }
      }
    };

    // Check on mount
    checkMyOrders();

    const handleEvent = () => {
      checkMyOrders();
    };

    window.addEventListener('momo-orders-change', handleEvent);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('momo_orders_channel');
      channel.onmessage = () => {
        checkMyOrders();
      };
    }

    // Realtime listener from Supabase
    const unsubscribeSupabase = subscribeToLiveOrders((updated) => {
      const myRefs = getMyOrderRefs();
      if (!myRefs.some((r) => r.id === updated.id)) return;

      const dismissed = getDismissedOrderIds();

      // CASE 1: Kitchen marked order 'ready' -> Pop up alert with chime!
      if (updated.status === 'ready' && !dismissed.includes(updated.id)) {
        setReadyOrder((prev) => {
          if (!prev || prev.id !== updated.id) {
            playChime(true);
          }
          return updated;
        });
      }

      // CASE 2: Order received / handed over (completed) or cancelled -> DISMISS IMMEDIATELY!
      if (updated.status === 'completed' || updated.status === 'cancelled') {
        markOrderDismissed(updated.id);
        setReadyOrder((prev) => (prev?.id === updated.id ? null : prev));
      }
    });

    // Periodic check every 8 seconds
    const interval = setInterval(checkMyOrders, 8000);

    return () => {
      isMounted = false;
      window.removeEventListener('momo-orders-change', handleEvent);
      channel?.close();
      unsubscribeSupabase();
      clearInterval(interval);
    };
  }, []);

  const handleDismiss = () => {
    if (readyOrder) {
      markOrderDismissed(readyOrder.id);
    }
    setReadyOrder(null);
  };

  if (!readyOrder) return null;

  return (
    <div className="fixed top-6 inset-x-4 z-[80] mx-auto max-w-md animate-bounce">
      <div className="relative flex flex-col gap-2 rounded-2xl border-2 border-green-500 bg-[#16301a]/95 p-5 shadow-[0_10px_40px_-5px_rgba(34,197,94,0.6)] backdrop-blur-xl text-[#f7ead2]">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-[#f7ead2]/60 hover:text-white transition-colors"
          title="Close notification"
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/50">
            <Bell size={24} className="animate-spin" />
          </div>
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-green-400">
              <Sparkles size={13} /> Order Ready for Pickup!
            </span>
            <h3 className="font-display text-xl font-bold text-white">
              Order #{readyOrder.orderNumber}
            </h3>
          </div>
        </div>

        <p className="mt-1 font-body text-xs text-[#f7ead2]/80 leading-relaxed">
          Hey <strong className="text-white">{readyOrder.customerName}</strong>, your hot steaming momos are ready at the counter! Please collect your box.
        </p>

        <button
          onClick={handleDismiss}
          className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-md hover:bg-green-400 transition-colors"
        >
          <Check size={14} className="stroke-[3]" />
          I&apos;ve Received My Order 👍
        </button>
      </div>
    </div>
  );
}
