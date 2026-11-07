export interface ServerMenuItem {
  id: string;
  name: string;
  isVeg: boolean;
  price6?: number;
  price10?: number;
  price?: number;
}

export const SERVER_MENU_CATALOG: Record<string, ServerMenuItem> = {
  // 1. Steamed Momos (100% Veg)
  'steam-veg':     { id: 'steam-veg',     name: 'Classic Veg Momos',         isVeg: true, price6: 40, price10: 65 },
  'steam-paneer':  { id: 'steam-paneer',  name: 'Fresh Paneer Momos',        isVeg: true, price6: 60, price10: 95 },
  'steam-corn':    { id: 'steam-corn',    name: 'Sweet Corn & Cheese Momos', isVeg: true, price6: 70, price10: 110 },

  // 2. Fried & Crispy Momos (100% Veg)
  'fried-veg':     { id: 'fried-veg',     name: 'Crispy Veg Fried Momos',    isVeg: true, price6: 50, price10: 80 },
  'fried-paneer':  { id: 'fried-paneer',  name: 'Paneer Fried Momos',        isVeg: true, price6: 70, price10: 110 },
  'fried-kurkure': { id: 'fried-kurkure', name: 'Kurkure Crunchy Momos',     isVeg: true, price6: 80, price10: 120 },

  // 3. Tandoori Smoked Momos (6 pcs)
  'tand-veg':      { id: 'tand-veg',      name: 'Charcoal Veg Tandoori',     isVeg: true, price: 70 },
  'tand-paneer':   { id: 'tand-paneer',   name: 'Smoked Paneer Tikka Momos', isVeg: true, price: 90 },
  'tand-mushroom': { id: 'tand-mushroom', name: 'Mushroom & Herb Tandoori',  isVeg: true, price: 95 },

  // 4. Gravy & Special Momos (6 pcs)
  'gravy-schezwan':   { id: 'gravy-schezwan',   name: 'Spicy Schezwan Momos',     isVeg: true, price: 80 },
  'gravy-periperi':   { id: 'gravy-periperi',   name: 'Peri Peri Tossed Momos',   isVeg: true, price: 85 },
  'gravy-cheesecorn': { id: 'gravy-cheesecorn', name: 'Melted Cheese Corn Momos', isVeg: true, price: 90 },
  'gravy-afghani':    { id: 'gravy-afghani',    name: 'Creamy Malai Afghani',     isVeg: true, price: 100 },

  // 5. Value Combos
  'combo-drink':  { id: 'combo-drink',  name: 'Veg Momos (6 pcs) + Cold Drink', isVeg: true, price: 70 },
  'combo-family': { id: 'combo-family', name: 'Family Veg Platter (20 pcs mixed)', isVeg: true, price: 220 },

  // 6. Chutneys & Drinks
  'extra-chutney': { id: 'extra-chutney', name: 'Fire Chilli Momo Chutney', isVeg: true, price: 10 },
  'extra-mayo':    { id: 'extra-mayo',    name: 'Garlic Cream Mayo Dip',    isVeg: true, price: 15 },
  'extra-drink':   { id: 'extra-drink',   name: 'Chilled Soft Drink',       isVeg: true, price: 20 },
  'extra-water':   { id: 'extra-water',   name: 'Mineral Water Bottle',     isVeg: true, price: 20 },
};

export interface CalculatedItem {
  itemId: string;
  name: string;
  variant: '6' | '10' | null;
  unitPrice: number;
  qty: number;
  subtotal: number;
  isVeg: boolean;
}

export interface CalculationResult {
  items: CalculatedItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

/**
 * Calculates pricing STRICTLY on the server using authoritative menu data.
 * Client-submitted prices are completely disregarded.
 */
export function calculateServerOrder(
  requestedItems: Array<{ itemId: string; variant?: '6' | '10' | null; qty: number }>
): CalculationResult {
  if (!requestedItems || requestedItems.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  let subtotal = 0;
  const processedItems: CalculatedItem[] = [];

  for (const reqItem of requestedItems) {
    const menuItem = SERVER_MENU_CATALOG[reqItem.itemId];
    if (!menuItem) {
      throw new Error(`Invalid item ID: ${reqItem.itemId}`);
    }

    if (reqItem.qty < 1 || reqItem.qty > 20 || !Number.isInteger(reqItem.qty)) {
      throw new Error(`Invalid quantity (${reqItem.qty}) for ${menuItem.name}. Must be between 1 and 20.`);
    }

    let unitPrice = 0;
    let variant: '6' | '10' | null = null;

    if (menuItem.price6 !== undefined && menuItem.price10 !== undefined) {
      if (reqItem.variant !== '6' && reqItem.variant !== '10') {
        throw new Error(`Variant (6 or 10 pcs) must be specified for ${menuItem.name}`);
      }
      variant = reqItem.variant;
      unitPrice = variant === '6' ? menuItem.price6 : menuItem.price10;
    } else {
      unitPrice = menuItem.price ?? 0;
    }

    const itemSubtotal = unitPrice * reqItem.qty;
    subtotal += itemSubtotal;

    processedItems.push({
      itemId: menuItem.id,
      name: menuItem.name,
      variant,
      unitPrice,
      qty: reqItem.qty,
      subtotal: itemSubtotal,
      isVeg: menuItem.isVeg,
    });
  }

  // Calculate tax & final total
  const tax = 0; // Street food pricing is net inclusive
  const discount = 0;
  const total = subtotal + tax - discount;

  return {
    items: processedItems,
    subtotal,
    tax,
    discount,
    total,
  };
}
