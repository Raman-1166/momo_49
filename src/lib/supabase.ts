import { createClient } from '@supabase/supabase-js';
import type { Order, OrderStatus, PaymentStatus } from '@/store/orders';

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://vmuxycyzmjyxtvrkhzux.supabase.co';

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_JfOSnA5CMHL-y4RgNWKYxQ_dc5wvagF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Maps Supabase PostgreSQL database row to frontend Order model
 */
export function rowToOrder(row: any): Order {
  let items = [];
  try {
    items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : row.items_json || [];
  } catch {
    items = [];
  }

  return {
    id: row.id,
    orderNumber: row.order_number,
    accessToken: row.access_token,
    customerName: row.customer_name,
    contactNumber: row.contact_number,
    items,
    totalPrice: row.total_price,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status as PaymentStatus,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    estimatedMinutes: row.estimated_minutes,
  };
}
