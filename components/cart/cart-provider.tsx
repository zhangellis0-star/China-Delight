"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartCustomization, CartItem, MenuItem, MenuPriceKey } from "@/types";
import { customizationUpcharge, getItemPrice } from "@/lib/pricing";

type CartContextValue = {
  items: CartItem[];
  count: number;
  addItem: (item: MenuItem, customization: CartCustomization, quantity?: number) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  updateNotes: (cartId: string, notes: string) => void;
  removeItem: (cartId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const storageKey = "china-delight-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setItems(JSON.parse(saved));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem(item, customization, quantity = 1) {
        const size = customization.size as MenuPriceKey;
        const unitPrice = getItemPrice(item, size) + customizationUpcharge(customization.addOns);
        const cartId = `${item.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setItems((current) => [
          ...current,
          {
            cartId,
            menuItemId: item.id,
            number: item.number,
            name: item.name,
            category: item.category,
            quantity,
            unitPrice,
            customization
          }
        ]);
      },
      updateQuantity(cartId, quantity) {
        setItems((current) => current.map((item) => (item.cartId === cartId ? { ...item, quantity: Math.max(1, quantity) } : item)));
      },
      updateNotes(cartId, notes) {
        setItems((current) => current.map((item) => (item.cartId === cartId ? { ...item, customization: { ...item.customization, notes } } : item)));
      },
      removeItem(cartId) {
        setItems((current) => current.filter((item) => item.cartId !== cartId));
      },
      clearCart() {
        setItems([]);
      }
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
