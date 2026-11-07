/**
 * Stall configuration — edit this file to update public location, contact, timings,
 * and UPI display details.
 * Note: Admin credentials and secrets are kept strictly server-side in .env
 */
export const stallConfig = {
  name: 'Momos Stall',
  tagline: 'Hot, fresh and made with love',
  location: 'Shop No. 4, Hill Cart Road, Siliguri — 734001',
  phone: '+91 98765 43210',
  timings: 'Mon – Sun: 11:00 AM – 11:00 PM',
  mapsUrl: '#',
  /** UPI ID shown to customers on the payment screen */
  upiId: 'momosstall@upi',
} as const;

