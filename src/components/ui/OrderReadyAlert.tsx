import { useEffect, useState } from 'react';
import { Bell, X, Sparkles } from 'lucide-react';
import { getMyOrderRefs, fetchOrderById, playChime, type Order } from '@/store/orders';

export function OrderReadyAlert() {
  const [readyOrder, setReadyOrder] = useState<Order | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkMyOrders = async () => {
      const myRefs = getMyOrderRefs();
      if (!myRefs.length) return;

      // Check the latest active orders
      for (const ref of myRefs.slice(0, 5)) {
        const order = await fetchOrderById(ref.id, ref.accessToken);
        if (!isMounted || !order) continue;

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

    // Periodic check every 8 seconds
    const interval = setInterval(checkMyOrders, 8000);

    return () => {
      isMounted = false;
      window.removeEventListener('momo-orders-change', handleEvent);
      channel?.close();
      clearInterval(interval);
    };
  }, []);

  if (!readyOrder) return null;

  return (
    <div className="fixed top-6 inset-x-4 z-[80] mx-auto max-w-md animate-bounce">
      <div className="relative flex flex-col gap-2 rounded-2xl border-2 border-green-500 bg-[#16301a]/95 p-5 shadow-[0_10px_40px_-5px_rgba(34,197,94,0.6)] backdrop-blur-xl text-[#f7ead2]">
        <button
          onClick={() => setReadyOrder(null)}
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-[#f7ead2]/60 hover:text-white"
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
          onClick={() => setReadyOrder(null)}
          className="mt-2 w-full rounded-xl bg-green-500 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-md hover:bg-green-400 transition-colors"
        >
          I&apos;m Collecting Now 👍
        </button>
      </div>
    </div>
  );
}
