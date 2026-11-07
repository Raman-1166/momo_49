/**
 * Cart store — React Context + useReducer with secure, minimal storage.
 * STEP 8: Cart in localStorage stores ONLY itemId, variant and qty.
 * Prices and personal data are NEVER stored in localStorage.
 */
import { createContext, useContext, useReducer, useEffect, type ReactNode, createElement } from 'react';
import { menuCategories } from '@/data/menu';

export interface CartItem {
  key: string;
  itemId: string;
  name: string;
  variant: '6' | '10' | null;
  unitPrice: number;
  qty: number;
  isVeg: boolean;
}

interface StoredCartMinimal {
  itemId: string;
  variant: '6' | '10' | null;
  qty: number;
}

const CART_STORAGE_KEY = 'momo_cart_safe_v1';

function findMenuItem(itemId: string) {
  for (const cat of menuCategories) {
    const item = cat.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return null;
}

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const minItems: StoredCartMinimal[] = JSON.parse(raw);
    const restored: CartItem[] = [];

    for (const m of minItems) {
      const item = findMenuItem(m.itemId);
      if (!item) continue;

      let unitPrice = 0;
      if (item.price6 !== undefined && item.price10 !== undefined) {
        if (m.variant === '6') unitPrice = item.price6;
        else if (m.variant === '10') unitPrice = item.price10;
        else continue;
      } else {
        unitPrice = item.price ?? 0;
      }

      const key = m.variant ? `${m.itemId}-${m.variant}` : m.itemId;
      restored.push({
        key,
        itemId: m.itemId,
        name: item.name,
        variant: m.variant,
        unitPrice,
        qty: Math.max(1, Math.min(20, Math.floor(m.qty || 1))),
        isVeg: item.isVeg,
      });
    }

    return restored;
  } catch {
    return [];
  }
}

function saveCartMinimal(items: CartItem[]): void {
  try {
    // Only persist itemId, variant, qty (never prices or personal data)
    const minimal: StoredCartMinimal[] = items.map((i) => ({
      itemId: i.itemId,
      variant: i.variant,
      qty: i.qty,
    }));
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(minimal));
  } catch (err) {
    console.error('Failed to save cart to localStorage', err);
  }
}

type CartAction =
  | { type: 'ADD'; payload: Omit<CartItem, 'qty'> }
  | { type: 'REMOVE'; key: string }
  | { type: 'SET_QTY'; key: string; qty: number }
  | { type: 'CLEAR' };

interface CartState {
  items: CartItem[];
}

function reducer(state: CartState, action: CartAction): CartState {
  let nextState: CartState;
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find((i) => i.key === action.payload.key);
      if (existing) {
        const nextQty = Math.min(20, existing.qty + 1);
        nextState = {
          items: state.items.map((i) =>
            i.key === action.payload.key ? { ...i, qty: nextQty } : i
          ),
        };
      } else {
        nextState = { items: [...state.items, { ...action.payload, qty: 1 }] };
      }
      break;
    }
    case 'REMOVE':
      nextState = { items: state.items.filter((i) => i.key !== action.key) };
      break;
    case 'SET_QTY': {
      if (action.qty <= 0) {
        nextState = { items: state.items.filter((i) => i.key !== action.key) };
      } else {
        const clampedQty = Math.min(20, action.qty);
        nextState = {
          items: state.items.map((i) =>
            i.key === action.key ? { ...i, qty: clampedQty } : i
          ),
        };
      }
      break;
    }
    case 'CLEAR':
      nextState = { items: [] };
      break;
    default:
      return state;
  }

  saveCartMinimal(nextState.items);
  return nextState;
}

interface CartContextValue {
  items: CartItem[];
  totalQty: number;
  totalPrice: number;
  add: (item: Omit<CartItem, 'qty'>) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] }, () => ({
    items: loadInitialCart(),
  }));

  useEffect(() => {
    saveCartMinimal(state.items);
  }, [state.items]);

  const totalQty = state.items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = state.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  const value: CartContextValue = {
    items: state.items,
    totalQty,
    totalPrice,
    add: (item) => dispatch({ type: 'ADD', payload: item }),
    remove: (key) => dispatch({ type: 'REMOVE', key }),
    setQty: (key, qty) => dispatch({ type: 'SET_QTY', key, qty }),
    clear: () => dispatch({ type: 'CLEAR' }),
  };

  return createElement(CartContext.Provider, { value }, children);
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
