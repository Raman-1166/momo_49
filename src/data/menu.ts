/**
 * Menu data — 100% Pure Vegetarian Momo Atelier
 * All momos are hand-pleated with fresh farm ingredients and authentic Himalayan spices.
 *
 * Price fields:
 *   - `price`         → single price (6-pcs / fixed)
 *   - `price6` / `price10` → two variants (6 pcs and 10 pcs)
 *
 * `isVeg: true`  → 100% Pure Veg
 */

export type Variant = '6pcs' | '10pcs' | 'fixed';

export interface MenuItem {
  id: string;
  name: string;
  isVeg: true; // Strictly 100% vegetarian
  /** Use when two pack-sizes are available */
  price6?: number;
  price10?: number;
  /** Use when there is only one price */
  price?: number;
}

export interface MenuCategory {
  id: string;
  label: string;
  /** Display hint shown below the category tab */
  note?: string;
  items: MenuItem[];
}

export interface AddOn {
  id: string;
  label: string;
  /** '+15' or 'Free' */
  priceNote: string;
}

// ─── 100% Pure Veg Categories ──────────────────────────────────────────────────

export const menuCategories: MenuCategory[] = [
  {
    id: 'steamed',
    label: 'Steamed',
    note: '6 pcs / 10 pcs',
    items: [
      { id: 'steam-veg',    name: 'Classic Veg Momos',         isVeg: true, price6: 40, price10: 65 },
      { id: 'steam-paneer', name: 'Fresh Paneer Momos',        isVeg: true, price6: 60, price10: 95 },
      { id: 'steam-corn',   name: 'Sweet Corn & Cheese Momos', isVeg: true, price6: 70, price10: 110 },
    ],
  },
  {
    id: 'fried',
    label: 'Fried & Crispy',
    note: '6 pcs / 10 pcs',
    items: [
      { id: 'fried-veg',    name: 'Crispy Veg Fried Momos',    isVeg: true, price6: 50, price10: 80 },
      { id: 'fried-paneer', name: 'Paneer Fried Momos',        isVeg: true, price6: 70, price10: 110 },
      { id: 'fried-kurkure',name: 'Kurkure Crunchy Momos',     isVeg: true, price6: 80, price10: 120 },
    ],
  },
  {
    id: 'tandoori',
    label: 'Tandoori Smoked',
    note: '6 pcs',
    items: [
      { id: 'tand-veg',      name: 'Charcoal Veg Tandoori',     isVeg: true, price: 70 },
      { id: 'tand-paneer',   name: 'Smoked Paneer Tikka Momos', isVeg: true, price: 90 },
      { id: 'tand-mushroom', name: 'Mushroom & Herb Tandoori',  isVeg: true, price: 95 },
    ],
  },
  {
    id: 'gravy',
    label: 'Gravy & Special',
    note: '6 pcs',
    items: [
      { id: 'gravy-schezwan',   name: 'Spicy Schezwan Momos',    isVeg: true, price: 80 },
      { id: 'gravy-periperi',   name: 'Peri Peri Tossed Momos',  isVeg: true, price: 85 },
      { id: 'gravy-cheesecorn', name: 'Melted Cheese Corn Momos',isVeg: true, price: 90 },
      { id: 'gravy-afghani',    name: 'Creamy Malai Afghani',    isVeg: true, price: 100 },
    ],
  },
  {
    id: 'combos',
    label: 'Value Combos',
    items: [
      { id: 'combo-drink',  name: 'Veg Momos (6 pcs) + Cold Drink', isVeg: true, price: 70 },
      { id: 'combo-family', name: 'Family Veg Platter (20 pcs mixed)', isVeg: true, price: 220 },
    ],
  },
  {
    id: 'extras',
    label: 'Chutneys & Drinks',
    items: [
      { id: 'extra-chutney', name: 'Fire Chilli Momo Chutney', isVeg: true, price: 10 },
      { id: 'extra-mayo',    name: 'Garlic Cream Mayo Dip',    isVeg: true, price: 15 },
      { id: 'extra-drink',   name: 'Chilled Soft Drink',       isVeg: true, price: 20 },
      { id: 'extra-water',   name: 'Mineral Water Bottle',     isVeg: true, price: 20 },
    ],
  },
];

// ─── Add-ons ──────────────────────────────────────────────────────────────────

export const addOns: AddOn[] = [
  { id: 'addon-spicy',  label: 'Extra Spicy',  priceNote: 'Free' },
  { id: 'addon-cheese', label: 'Extra Cheese', priceNote: '+₹15' },
  { id: 'addon-oil',    label: 'Less Oil',     priceNote: 'Free' },
];
