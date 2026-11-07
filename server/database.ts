import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { CalculatedItem } from './menuData';

export type ServerOrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'refunded';

export interface DatabaseOrder {
  id: string; // UUID e.g. "ord_..."
  orderNumber: number; // e.g. 101
  accessToken: string; // 48-char hex secret
  customerName: string;
  contactNumber: string;
  items: CalculatedItem[];
  totalPrice: number;
  paymentMethod: 'upi' | 'cash';
  paymentStatus: PaymentStatus;
  status: ServerOrderStatus;
  createdAt: string;
  estimatedMinutes: number;
  paymentGatewayOrderId?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'momo.db');
export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency & performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number INTEGER NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    total_price INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    items_json TEXT NOT NULL,
    payment_gateway_order_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

  CREATE TABLE IF NOT EXISTS webhook_events (
    event_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL,
    order_id TEXT NOT NULL
  );
`);

// Row mapper
function rowToOrder(row: any): DatabaseOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    accessToken: row.access_token,
    customerName: row.customer_name,
    contactNumber: row.contact_number,
    totalPrice: row.total_price,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    createdAt: row.created_at,
    estimatedMinutes: row.estimated_minutes,
    items: JSON.parse(row.items_json),
    paymentGatewayOrderId: row.payment_gateway_order_id || undefined,
  };
}

// Next order number generator
export function getNextOrderNumber(): number {
  const row: any = db.prepare('SELECT MAX(order_number) as maxNum FROM orders').get();
  return (row && row.maxNum && row.maxNum >= 100) ? row.maxNum + 1 : 101;
}

// Insert Order
export function insertOrder(order: DatabaseOrder): void {
  const stmt = db.prepare(`
    INSERT INTO orders (
      id, order_number, access_token, customer_name, contact_number,
      total_price, payment_method, payment_status, status,
      created_at, estimated_minutes, items_json, payment_gateway_order_id
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  stmt.run(
    order.id,
    order.orderNumber,
    order.accessToken,
    order.customerName,
    order.contactNumber,
    order.totalPrice,
    order.paymentMethod,
    order.paymentStatus,
    order.status,
    order.createdAt,
    order.estimatedMinutes,
    JSON.stringify(order.items),
    order.paymentGatewayOrderId || null
  );
}

// Get order by ID
export function getOrderById(id: string): DatabaseOrder | undefined {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return row ? rowToOrder(row) : undefined;
}

// Get all orders for Admin
export function getAllOrdersFromDb(): DatabaseOrder[] {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  return rows.map(rowToOrder);
}

// Update order status
export function updateOrderStatusInDb(id: string, status: ServerOrderStatus): DatabaseOrder | undefined {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  return getOrderById(id);
}

// Add extra items to active order
export function addItemsToOrderInDb(
  id: string,
  newItems: CalculatedItem[],
  addedPrice: number,
  additionalMinutes: number
): DatabaseOrder | undefined {
  const order = getOrderById(id);
  if (!order) return undefined;

  const mergedItems = [...order.items, ...newItems];
  const newTotal = order.totalPrice + addedPrice;
  const newEstimatedMinutes = order.estimatedMinutes + additionalMinutes;

  db.prepare(`
    UPDATE orders 
    SET items_json = ?, total_price = ?, estimated_minutes = ?
    WHERE id = ?
  `).run(JSON.stringify(mergedItems), newTotal, newEstimatedMinutes, id);

  return getOrderById(id);
}

// Mark payment as received (for UPI/QR or counter payment by Admin)
export function markPaymentReceivedInDb(id: string): DatabaseOrder | undefined {
  db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(id);
  return getOrderById(id);
}

// Idempotent webhook payment update
export function markOrderPaidWebhookInDb(
  orderId: string,
  eventId: string,
  gatewayOrderId?: string
): { success: boolean; alreadyProcessed: boolean; order?: DatabaseOrder } {
  const existingEvent = db.prepare('SELECT event_id FROM webhook_events WHERE event_id = ?').get(eventId);
  if (existingEvent) {
    return { success: true, alreadyProcessed: true };
  }

  const order = getOrderById(orderId);
  if (!order) {
    return { success: false, alreadyProcessed: false };
  }

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO webhook_events (event_id, processed_at, order_id) VALUES (?, ?, ?)').run(
      eventId,
      new Date().toISOString(),
      orderId
    );

    db.prepare(
      "UPDATE orders SET payment_status = 'paid', payment_gateway_order_id = COALESCE(?, payment_gateway_order_id) WHERE id = ?"
    ).run(gatewayOrderId || null, orderId);
  });

  tx();

  return { success: true, alreadyProcessed: false, order: getOrderById(orderId) };
}

