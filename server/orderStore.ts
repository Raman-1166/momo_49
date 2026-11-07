import crypto from 'crypto';
import type { CalculatedItem } from './menuData';
import {
  insertOrder,
  getOrderById,
  getAllOrdersFromDb,
  updateOrderStatusInDb,
  markPaymentReceivedInDb,
  markOrderPaidWebhookInDb,
  addItemsToOrderInDb,
  getNextOrderNumber,
  type DatabaseOrder,
  type ServerOrderStatus,
  type PaymentStatus,
} from './database';

export type { ServerOrderStatus, PaymentStatus };
export type ServerOrder = DatabaseOrder;

export function createServerOrder(data: {
  customerName: string;
  contactNumber: string;
  items: CalculatedItem[];
  totalPrice: number;
  paymentMethod: 'upi' | 'cash';
}): ServerOrder {
  const unguessableId = `ord_${crypto.randomUUID()}`;
  const accessToken = crypto.randomBytes(24).toString('hex');
  const orderNumber = getNextOrderNumber();

  const totalItemCount = data.items.reduce((acc, i) => acc + i.qty, 0);
  const estimatedMinutes = Math.min(25, Math.max(8, 8 + Math.floor(totalItemCount * 1.5)));

  // UPI orders start as 'pending_verification' until owner marks payment received
  const initialPaymentStatus: PaymentStatus =
    data.paymentMethod === 'upi' ? 'pending_verification' : 'unpaid';

  const newOrder: ServerOrder = {
    id: unguessableId,
    orderNumber,
    accessToken,
    customerName: data.customerName,
    contactNumber: data.contactNumber,
    items: data.items,
    totalPrice: data.totalPrice,
    paymentMethod: data.paymentMethod,
    paymentStatus: initialPaymentStatus,
    status: 'pending',
    createdAt: new Date().toISOString(),
    estimatedMinutes,
  };

  insertOrder(newOrder);
  return newOrder;
}

export function getAllOrders(): ServerOrder[] {
  return getAllOrdersFromDb();
}

export function findOrderById(id: string): ServerOrder | undefined {
  return getOrderById(id);
}

export function updateOrderStatusOnServer(id: string, status: ServerOrderStatus): ServerOrder | undefined {
  return updateOrderStatusInDb(id, status);
}

export function markPaymentReceivedOnServer(id: string): ServerOrder | undefined {
  return markPaymentReceivedInDb(id);
}

export function addItemsToExistingOrder(
  id: string,
  accessToken: string,
  additionalItems: CalculatedItem[],
  addedPrice: number,
  additionalMinutes: number
): ServerOrder | null {
  const order = findOrderById(id);
  if (!order) return null;
  if (order.accessToken !== accessToken) return null;
  if (order.status === 'completed' || order.status === 'cancelled') {
    throw new Error('Cannot add items to completed or cancelled orders');
  }

  return addItemsToOrderInDb(id, additionalItems, addedPrice, additionalMinutes) || null;
}

export function markOrderPaidViaWebhook(
  orderId: string,
  eventId: string,
  gatewayOrderId?: string
) {
  return markOrderPaidWebhookInDb(orderId, eventId, gatewayOrderId);
}

export function checkOrderAccess(
  order: ServerOrder,
  token?: string,
  phone?: string,
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  if (token && order.accessToken === token) return true;
  if (phone && order.contactNumber.replace(/\D/g, '') === phone.replace(/\D/g, '')) return true;
  return false;
}

export function toPublicOrder(order: ServerOrder) {
  return order;
}
