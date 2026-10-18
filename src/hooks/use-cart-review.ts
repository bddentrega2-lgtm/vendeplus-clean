"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartItem } from "@/types";
import type { CartReview } from "@/lib/cart-review";
import { getCart, saveCart } from "@/lib/cart";

export function useCartReview(storeSlug: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [review, setReview] = useState<CartReview | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const snapshot = useRef("");
  const requestId = useRef(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const sync = () => { setItems(getCart(storeSlug)); setReview(null); setChecking(true); retry(); };
    const onChange = (event: Event) => {
      if ((event as CustomEvent).detail?.storeSlug === storeSlug) sync();
    };
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === `vendeplus_cart_${storeSlug}`) sync(); };
    sync();
    window.addEventListener("vendeplus-cart-change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("vendeplus-cart-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [storeSlug, retry]);

  useEffect(() => {
    const id = ++requestId.current;
    let active = true;
    const controller = new AbortController();
    const current = getCart(storeSlug);
    const serialized = JSON.stringify(current);
    setChecking(true);
    setError("");
    setReview(null);
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const timer = window.setTimeout(async () => {
      try {
        if (!current.length) { snapshot.current = serialized; setReview({ items: [], issues: [] }); return; }
        const response = await fetch("/api/catalog/cart-review", {
          method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
          body: JSON.stringify({ storeSlug, items: current }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No pudimos revisar el carrito.");
        if (!active || id !== requestId.current || JSON.stringify(getCart(storeSlug)) !== serialized) return;
        snapshot.current = serialized;
        setReview(data);
      } catch (failure) {
        if (active && id === requestId.current) setError(controller.signal.aborted ? "La revisión tardó demasiado. Intenta de nuevo." : failure instanceof Error ? failure.message : "No pudimos revisar el carrito.");
      } finally {
        window.clearTimeout(timeout);
        if (active && id === requestId.current) setChecking(false);
      }
    }, 120);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); window.clearTimeout(timeout); };
  }, [revision, storeSlug]);

  function receive(next: CartReview, sent: CartItem[]) {
    if (JSON.stringify(getCart(storeSlug)) !== JSON.stringify(sent)) { retry(); return; }
    ++requestId.current;
    snapshot.current = JSON.stringify(sent);
    setItems(sent);
    setReview(next);
    setChecking(false);
    setError("");
  }

  function change(index: number, action: "remove" | "price") {
    const current = getCart(storeSlug);
    if (JSON.stringify(current) !== snapshot.current) { retry(); return; }
    if (action === "price" && !review?.issues.some(issue => issue.index === index && issue.kind === "price")) return;
    const next = action === "remove" ? current.filter((_, i) => i !== index)
      : current.map((item, i) => i === index ? review!.items[i] : item);
    try { saveCart(storeSlug, next); } catch { setError("No pudimos guardar el cambio en este dispositivo. Intenta de nuevo."); }
  }

  return { items, review, checking, error, retry, receive, change,
    blocked: checking || Boolean(error) || !review || review.issues.length > 0 };
}
