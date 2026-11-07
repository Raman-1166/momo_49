import { z } from 'zod';

/**
 * Strips HTML tags, control characters and trims leading/trailing spaces
 * to protect against stored and reflected Cross-Site Scripting (XSS).
 */
export function sanitizeString(val: string): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[<>]/g, '') // Strip < and >
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Strip control chars
    .trim();
}

export const customerNameSchema = z
  .string()
  .min(2, { message: 'Customer name must be at least 2 characters' })
  .max(60, { message: 'Customer name must not exceed 60 characters' })
  .transform(sanitizeString)
  .refine((v) => v.length >= 2, { message: 'Invalid customer name' });

export const contactNumberSchema = z
  .string()
  .transform(sanitizeString)
  .refine((v) => /^\d{10}$/.test(v), {
    message: 'Contact number must be exactly 10 digits',
  });

export const orderItemInputSchema = z.object({
  itemId: z.string().min(1).max(50),
  variant: z.enum(['6', '10']).nullable().optional(),
  qty: z
    .number()
    .int({ message: 'Quantity must be a whole number' })
    .min(1, { message: 'Minimum quantity is 1' })
    .max(20, { message: 'Maximum quantity per item is 20' }),
});

export const checkoutRequestSchema = z.object({
  customerName: customerNameSchema,
  contactNumber: contactNumberSchema,
  items: z
    .array(orderItemInputSchema)
    .min(1, { message: 'Cart cannot be empty' })
    .max(30, { message: 'Too many distinct items in cart' }),
  paymentMethod: z.enum(['upi', 'cash']),
  // Honeypot field for bot prevention (STEP 7): must be empty
  hp_bot_check: z
    .string()
    .max(0, { message: 'Bot submission detected' })
    .optional()
    .or(z.literal('')),
});

export const addItemsRequestSchema = z.object({
  accessToken: z.string().min(10),
  items: z
    .array(orderItemInputSchema)
    .min(1, { message: 'Must provide at least one item' })
    .max(20, { message: 'Too many items in single addition' }),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(100),
});

export type CheckoutInput = z.infer<typeof checkoutRequestSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

