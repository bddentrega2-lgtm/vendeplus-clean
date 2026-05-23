import type { CartItem } from "@/types";

export function getCartKey(storeSlug: string) {
  return `vendeplus_cart_${storeSlug}`;
}

function emitCartChange(storeSlug: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vendeplus-cart-change", { detail: { storeSlug } }));
}

export function getCart(storeSlug: string): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getCartKey(storeSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(storeSlug: string, items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getCartKey(storeSlug), JSON.stringify(items));
  emitCartChange(storeSlug);
}

export function clearCart(storeSlug: string) {
  saveCart(storeSlug, []);
}

export function getCartCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function getCartSubtotal(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity * item.unitPriceUsd, 0);
}

export function addToCart(storeSlug: string, item: CartItem) {
  const current = getCart(storeSlug);
  const existingIndex = current.findIndex(
    (cartItem) =>
      cartItem.productId === item.productId &&
      cartItem.variantId === item.variantId &&
      (cartItem.notes || "") === (item.notes || ""),
  );

  if (existingIndex >= 0) {
    current[existingIndex] = {
      ...current[existingIndex],
      quantity: current[existingIndex].quantity + item.quantity,
    };
    saveCart(storeSlug, current);
    return;
  }

  saveCart(storeSlug, [...current, item]);
}

export function updateCartItemQuantity(storeSlug: string, index: number, quantity: number) {
  const current = getCart(storeSlug);
  if (!current[index]) return;

  if (quantity <= 0) {
    current.splice(index, 1);
  } else {
    current[index] = { ...current[index], quantity };
  }

  saveCart(storeSlug, current);
}

export function removeCartItem(storeSlug: string, index: number) {
  const current = getCart(storeSlug);
  current.splice(index, 1);
  saveCart(storeSlug, current);
}
