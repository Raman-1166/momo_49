import type { CartItem } from './cart';
import { checkoutRequestSchema } from '@/lib/schemas';

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

// Broadcast updates across tabs
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

/**
 * Submits checkout to the server.
 * STEP 2: The client sends ONLY itemId, variant and qty.
 * The server calculates all prices, tax and totals.
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

  // 2. Submit to backend API
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

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Order placement failed' }));
    throw new Error(errData.error || 'Server rejected order request');
  }

  const result = await response.json();
  const createdOrder: Order = result.order;

  // 3. Save unguessable token in localStorage for secure viewing
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
 * Fetch a customer order securely with its token
 */
export async function fetchOrderById(id: string, token?: string): Promise<Order | null> {
  try {
    const url = token ? `/api/orders/${id}?token=${encodeURIComponent(token)}` : `/api/orders/${id}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.order;
  } catch {
    return null;
  }
}

/**
 * Customer: Add extra items to active order
 */
export async function addItemsToOrder(
  orderId: string,
  accessToken: string,
  newItems: Array<{ itemId: string; variant?: '6' | '10' | null; qty: number }>
): Promise<Order> {
  const res = await fetch(`/api/orders/${orderId}/add-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken,
      items: newItems,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to add items' }));
    throw new Error(err.error || 'Failed to add items to order');
  }

  const data = await res.json();
  notifyOrderChange('ORDER_UPDATED', data.order);
  return data.order;
}

/**
 * Admin: Fetch all orders from backend
 */
export async function fetchAdminOrders(): Promise<Order[]> {
  const res = await fetch('/api/admin/orders');
  if (!res.ok) {
    throw new Error('Unauthorized or failed to fetch admin orders');
  }
  const data = await res.json();
  return data.orders || [];
}

/**
 * Admin: Update order status on backend
 */
export async function updateAdminOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const res = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update order status' }));
    throw new Error(err.error || 'Failed to update status');
  }

  const data = await res.json();
  notifyOrderChange('STATUS_CHANGE', { orderId, status });
  return data.order;
}

/**
 * Admin: Mark UPI/Cash payment as received
 */
export async function markAdminPaymentReceived(orderId: string): Promise<Order> {
  const res = await fetch(`/api/admin/orders/${orderId}/payment-received`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to mark payment received' }));
    throw new Error(err.error || 'Failed to update payment status');
  }

  const data = await res.json();
  notifyOrderChange('PAYMENT_RECEIVED', { orderId });
  return data.order;
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
