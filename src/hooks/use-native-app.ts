"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isNativeApp, readMobile, writeMobile } from "@/lib/mobile/state";

const subscribe = () => () => {};
const dirtyForms = new Set<symbol>();
const layers: symbol[] = [];
export function useNativeApp() { return useSyncExternalStore(subscribe, isNativeApp, () => false); }

export function confirmNativeLeave() {
  return !isNativeApp() || !dirtyForms.size || window.confirm("Tienes cambios sin guardar. ¿Salir sin guardarlos?");
}
export function useNativeDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty || !isNativeApp()) return;
    const id = Symbol(); dirtyForms.add(id);
    return () => { dirtyForms.delete(id); };
  }, [dirty]);
}

export function useNativeBackLayer(open: boolean, close: () => void) {
  const callback = useRef(close);
  useEffect(() => { callback.current = close; }, [close]);
  useEffect(() => {
    if (!open || !isNativeApp()) return;
    const id = Symbol(); layers.push(id);
    const handler = (event: Event) => {
      if (event.defaultPrevented || layers.at(-1) !== id) return;
      event.preventDefault();
      callback.current();
    };
    window.addEventListener("somos:back-layer", handler);
    return () => { layers.splice(layers.indexOf(id), 1); window.removeEventListener("somos:back-layer", handler); };
  }, [open]);
}

export function useNativeTextState(key: string, initial: string) {
  const [value, setValue] = useState(initial);
  const [loadedKey, setLoadedKey] = useState("");
  useEffect(() => {
    const saved = readMobile<unknown>(key, initial);
    setValue(typeof saved === "string" ? saved.slice(0, 200) : initial);
    setLoadedKey(key);
  }, [key, initial]);
  useEffect(() => { if (loadedKey === key) writeMobile(key, value); }, [key, value, loadedKey]);
  return [value, setValue] as const;
}
