import type { CartItem } from './cart';
import { checkoutRequestSchema } from '@/lib/schemas';
import { supabase, rowToOrder } from '@/lib/supabase';
import { menuCategories } from '@/data/menu';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'pending_verification';

export interface Order {
  id: string; // Unguessable UUID
  orderNumber: number; // Customer-friendly display number
  accessToken?: string; // Secret viewing token
  customerName: string;
  contactNumber: string;
  items: CartItem[];
  totalPrice: number;
  paymentMethod: 'upi' | 'cash';
  paymentStatus?: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  estimatedMinutes: number;
}

export interface MyOrderRef {
  id: string;
  orderNumber: number;
  accessToken: string;
}

const MY_ORDERS_KEY = 'momo_stall_my_orders';
const CHANNEL_NAME = 'momo_orders_channel';

// Get customer's saved order tokens (for IDOR-safe order status tracking)
export function getMyOrderRefs(): MyOrderRef[] {
  try {
    const raw = localStorage.getItem(MY_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMyOrderRef(ref: MyOrderRef): void {
  try {
    const existing = getMyOrderRefs();
    const updated = [ref, ...existing.filter((o) => o.id !== ref.id)];
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(updated.slice(0, 20))); // Keep last 20
  } catch (err) {
    console.error('Failed to save order ref', err);
  }
}

export function getLatestActiveOrder(): MyOrderRef | null {
  const refs = getMyOrderRefs();
  return refs.length > 0 ? refs[0] : null;
}

// Broadcast updates across browser tabs
export function notifyOrderChange(type: string, data?: any) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type, data });
      channel.close();
    }
  } catch (e) {
    console.warn(e);
  }
  window.dispatchEvent(new CustomEvent('momo-orders-change', { detail: { type, data } }));
}

// Helper: Calculate authoritative price from pure veg menu catalog
function calculateMenuPrice(itemId: string, variant: '6' | '10' | null): number {
  for (const cat of menuCategories) {
    const item = cat.items.find((i) => i.id === itemId);
    if (item) {
      if (variant === '6') return item.price6 || 0;
      if (variant === '10') return item.price10 || 0;
      return item.price || 0;
    }
  }
  return 0;
}

/**
 * Submits checkout to Supabase Cloud Database (with API server fallback)
 */
export async function placeOrder(params: {
  customerName: string;
  contactNumber: string;
  items: CartItem[];
  paymentMethod: 'upi' | 'cash';
  hp_bot_check?: string;
}): Promise<Order> {
  // 1. Client-side validation with Zod
  const orderItemsInput = params.items.map((i) => ({
    itemId: i.itemId,
    variant: i.variant,
    qty: i.qty,
  }));

  const validationResult = checkoutRequestSchema.safeParse({
    customerName: params.customerName,
    contactNumber: params.contactNumber,
    items: orderItemsInput,
    paymentMethod: params.paymentMethod,
    hp_bot_check: params.hp_bot_check || '',
  });

  if (!validationResult.success) {
    const errorMsg = validationResult.error.issues.map((e: { message: string }) => e.message).join(', ');
    throw new Error(errorMsg);
  }

  // First try backend API if available (e.g. during local dev or Render deploy)
  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: validationResult.data.customerName,
        contactNumber: validationResult.data.contactNumber,
        items: validationResult.data.items,
        paymentMethod: validationResult.data.paymentMethod,
        hp_bot_check: validationResult.data.hp_bot_check,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const createdOrder: Order = result.order;

      if (createdOrder.accessToken) {
        saveMyOrderRef({
          id: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          accessToken: createdOrder.accessToken,
        });
      }

      notifyOrderChange('NEW_ORDER', createdOrder);
      return createdOrder;
    }
  } catch {
    // API server not reachable or running on pure static Vercel — proceed to direct Supabase!
  }

  // 2. Direct Supabase Cloud Database Insert
  const unguessableId = `ord_${crypto.randomUUID()}`;
  const accessToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Re-calculate prices accurately from menu
  const validatedItems: CartItem[] = params.items.map((i) => {
    const unitPrice = calculateMenuPrice(i.itemId, i.variant as '6' | '10' | null);
    return {
      key: i.key,
      itemId: i.itemId,
      name: i.name,
      variant: i.variant,
      unitPrice,
      qty: i.qty,
      isVeg: true,
    };
  });

  const totalPrice = validatedItems.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);
  const totalItemCount = validatedItems.reduce((acc, i) => acc + i.qty, 0);
  const estimatedMinutes = Math.min(25, Math.max(8, 8 + Math.floor(totalItemCount * 1.5)));

  const initialPaymentStatus: PaymentStatus =
    params.paymentMethod === 'upi' ? 'pending_verification' : 'unpaid';

  const { data, error } = await supabase
    .from('orders')
    .insert({
      id: unguessableId,
      access_token: accessToken,
      customer_name: validationResult.data.customerName,
      contact_number: validationResult.data.contactNumber,
      total_price: totalPrice,
      payment_method: params.paymentMethod,
      payment_status: initialPaymentStatus,
      status: 'pending',
      estimated_minutes: estimatedMinutes,
      items_json: validatedItems,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[SUPABASE ORDER ERROR]', error);
    throw new Error(error?.message || 'Failed to create order in database');
  }

  const createdOrder = rowToOrder(data);

  if (createdOrder.accessToken) {
    saveMyOrderRef({
      id: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      accessToken: createdOrder.accessToken,
    });
  }

  notifyOrderChange('NEW_ORDER', createdOrder);
  return createdOrder;
}

/**
 * Fetch a customer order securely with its token from Supabase
 */
export async function fetchOrderById(id: string, token?: string): Promise<Order | null> {
  // 1. Try Supabase cloud database
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      if (!token || data.access_token === token) {
        return rowToOrder(data);
      }
    }
  } catch {
    // fallback
  }

  // 2. Fallback to API if available
  try {
    const url = token ? `/api/orders/${id}?token=${encodeURIComponent(token)}` : `/api/orders/${id}`;
    const res = await fetch(url);
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) return null;
    const data = await res.json();
    return data.order;
  } catch {
    return null;
  }
}

/**
 * Customer: Add extra items to active order in Supabase
 */
export async function addItemsToOrder(
  orderId: string,
  accessToken: string,
  newItems: Array<{ itemId: string; variant?: '6' | '10' | null; qty: number }>
): Promise<Order> {
  // Try API first
  try {
    const res = await fetch(`/api/orders/${orderId}/add-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        items: newItems,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      notifyOrderChange('ORDER_UPDATED', data.order);
      return data.order;
    }
  } catch {
    // API not available, proceed with Supabase directly
  }

  // Direct Supabase update
  const { data: current, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr || !current) {
    throw new Error('Order not found');
  }

  if (current.access_token !== accessToken) {
    throw new Error('Unauthorized');
  }

  if (current.status === 'completed' || current.status === 'cancelled') {
    throw new Error('Cannot add items to completed or cancelled orders');
  }

  const existingItems: CartItem[] = Array.isArray(current.items_json)
    ? current.items_json
    : JSON.parse(current.items_json || '[]');

  const formattedNewItems: CartItem[] = newItems.map((i) => {
    let itemName = '';
    for (const cat of menuCategories) {
      const found = cat.items.find((item) => item.id === i.itemId);
      if (found) {
        itemName = found.name;
        break;
      }
    }
    const unitPrice = calculateMenuPrice(i.itemId, i.variant || null);
    return {
      key: `${i.itemId}-${i.variant || ''}-${Date.now()}`,
      itemId: i.itemId,
      name: itemName || i.itemId,
      variant: i.variant || null,
      unitPrice,
      qty: i.qty,
      isVeg: true,
    };
  });

  const mergedItems = [...existingItems, ...formattedNewItems];
  const addedPrice = formattedNewItems.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);
  const newTotal = (current.total_price || 0) + addedPrice;
  const newMinutes = (current.estimated_minutes || 10) + Math.max(2, Math.floor(formattedNewItems.length * 1.5));

  const { data: updated, error: updateErr } = await supabase
    .from('orders')
    .update({
      items_json: mergedItems,
      total_price: newTotal,
      estimated_minutes: newMinutes,
    })
    .eq('id', orderId)
    .select()
    .single();

  if (updateErr || !updated) {
    throw new Error(updateErr?.message || 'Failed to update order in database');
  }

  const updatedOrder = rowToOrder(updated);
  notifyOrderChange('ORDER_UPDATED', updatedOrder);
  return updatedOrder;
}

/**
 * Admin: Fetch all orders from Supabase Cloud Database
 */
export async function fetchAdminOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map(rowToOrder);
    }
    if (error) {
      console.warn('[Supabase fetchAdminOrders warning]', error.message);
    }
  } catch (err) {
    console.warn('[Supabase fetchAdminOrders error]', err);
  }

  try {
    const res = await fetch('/api/admin/orders');
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data.orders) ? data.orders : [];
    }
  } catch {
    // backend not available
  }

  return [];
}

/**
 * Admin: Update order status in Supabase
 */
export async function updateAdminOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (!error && data) {
      const order = rowToOrder(data);
      notifyOrderChange('STATUS_CHANGE', { orderId, status });
      return order;
    }
    if (error) {
      console.warn('[Supabase update status warning]', error.message);
    }
  } catch (err) {
    console.warn('[Supabase update status error]', err);
  }

  const res = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  const ct = res.headers.get('content-type') || '';
  if (res.ok && ct.includes('application/json')) {
    const data = await res.json();
    notifyOrderChange('STATUS_CHANGE', { orderId, status });
    return data.order;
  }

  throw new Error('Failed to update status');
}

/**
 * Admin: Mark UPI/Cash payment as received in Supabase
 */
export async function markAdminPaymentReceived(orderId: string): Promise<Order> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId)
      .select()
      .single();

    if (!error && data) {
      const order = rowToOrder(data);
      notifyOrderChange('PAYMENT_RECEIVED', { orderId });
      return order;
    }
    if (error) {
      console.warn('[Supabase mark payment warning]', error.message);
    }
  } catch (err) {
    console.warn('[Supabase mark payment error]', err);
  }

  const res = await fetch(`/api/admin/orders/${orderId}/payment-received`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const ct = res.headers.get('content-type') || '';
  if (res.ok && ct.includes('application/json')) {
    const data = await res.json();
    notifyOrderChange('PAYMENT_RECEIVED', { orderId });
    return data.order;
  }

  throw new Error('Failed to update payment status');
}

/**
 * Shared singleton Real-time Supabase subscription across components
 * Prevents "cannot add postgres_changes callbacks after subscribe" error
 */
const orderListeners = new Set<(order: Order) => void>();
let globalRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToLiveOrders(onOrderUpdate: (order: Order) => void): () => void {
  orderListeners.add(onOrderUpdate);

  if (!globalRealtimeChannel) {
    try {
      globalRealtimeChannel = supabase
        .channel('public_orders_realtime_shared')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            if (payload && payload.new) {
              try {
                const order = rowToOrder(payload.new);
                orderListeners.forEach((cb) => {
                  try {
                    cb(order);
                  } catch (e) {
                    console.warn('[Realtime listener error]', e);
                  }
                });
              } catch (parseErr) {
                console.warn('[Realtime parse error]', parseErr);
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] Connected to live orders');
          }
        });
    } catch (subErr) {
      console.warn('[Supabase Realtime subscribe error]', subErr);
    }
  }

  return () => {
    orderListeners.delete(onOrderUpdate);
    if (orderListeners.size === 0 && globalRealtimeChannel) {
      try {
        supabase.removeChannel(globalRealtimeChannel);
      } catch (e) {
        console.warn(e);
      }
      globalRealtimeChannel = null;
    }
  };
}

// Notification chime
export function playChime(isReady = false) {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (isReady) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    }
  } catch (e) {
    // AudioContext blocked before interaction
  }
}
