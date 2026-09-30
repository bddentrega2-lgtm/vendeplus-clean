"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Home, Search, UserRound, Store, ShoppingBag, X, WifiOff, RefreshCw, Percent } from "lucide-react";
import { FrequentLocation } from "./FrequentLocation";
import { BuyerAuthResume } from "@/components/buyer/BuyerAuthResume";
import { confirmNativeLeave, useNativeApp, useNativeBackLayer } from "@/hooks/use-native-app";
import { mobileBackTarget, readMobile, safeMobileRoute, writeMobile } from "@/lib/mobile/state";
import { getCart, getCartCount } from "@/lib/cart";
import { clearCustomerBrowserProfile, getCustomerBrowserProfile, getCustomerIdParts, saveCustomerBrowserProfile } from "@/lib/customer-browser-profile";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncPanelServerSession } from "@/lib/panel/client-auth";
import { BrandLogo } from "@/components/public/BrandLogo";

export function NativeExperience() {
  const native = useNativeApp();
  const pathname = usePathname();
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [message, setMessage] = useState("");
  const [marketView, setMarketView] = useState("home");
  const [carts, setCarts] = useState<{ slug: string; count: number }[]>([]);
  const excluded = pathname.startsWith("/admin") || pathname.startsWith("/transporte") || pathname.startsWith("/auth");
  const buyer = !excluded && !pathname.startsWith("/panel") && pathname !== "/";
  useNativeBackLayer(profileOpen, () => setProfileOpen(false));
  useEffect(() => {
    const sync = (event: Event) => setMarketView((event as CustomEvent<string>).detail || "home");
    window.addEventListener("somos:market-view", sync);
    return () => window.removeEventListener("somos:market-view", sync);
  }, []);
  useEffect(() => {
    if (!profileOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [profileOpen]);

  useEffect(() => {
    if (!native) return;
    document.documentElement.classList.add("somos-native-app");
    const connectivity = () => setOffline(!navigator.onLine);
    let fullHeight = window.innerHeight;
    let width = window.innerWidth;
    const keyboard = () => {
      if (width !== window.innerWidth) { width = window.innerWidth; fullHeight = window.innerHeight; }
      const height = window.visualViewport?.height || window.innerHeight;
      fullHeight = Math.max(fullHeight, window.innerHeight);
      document.documentElement.classList.toggle("somos-keyboard-open", fullHeight - height > 150);
    };
    const resume = () => {
      if (document.visibilityState === "visible") {
        connectivity();
        window.dispatchEvent(new Event("somos:resume"));
      }
    };
    connectivity();
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    document.addEventListener("visibilitychange", resume);
    window.visualViewport?.addEventListener("resize", keyboard);
    window.addEventListener("resize", keyboard);
    return () => {
      document.documentElement.classList.remove("somos-native-app", "somos-keyboard-open");
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      document.removeEventListener("visibilitychange", resume);
      window.visualViewport?.removeEventListener("resize", keyboard);
      window.removeEventListener("resize", keyboard);
    };
  }, [native]);

  useEffect(() => {
    if (!native || pathname !== "/") return;
    let cancelled = false;
    async function enter() {
      const space = readMobile<string>("space", "");
      if (space !== "buy") {
        try {
          const { data } = await createSupabaseBrowserClient()?.auth.getSession() || { data: null };
          if (data?.session) {
            await syncPanelServerSession(data.session.access_token);
            const response = await fetch("/api/panel/context", { cache: "no-store", signal: AbortSignal.timeout(10000) });
            if (!response.ok && response.status !== 401 && response.status !== 403) throw new Error("context");
            const context = response.ok ? await response.json() : null;
            if (context?.stores?.length && !context.isFounderMode) {
              // Restore a private route only for the account validated by the backend.
              const saved = readMobile("account", "") === context.userId ? safeMobileRoute(readMobile("private_route", "")) : null;
              if (!cancelled) router.replace(saved?.startsWith("/panel") ? saved : "/panel/pedidos");
              return;
            }
          }
        } catch { if (!cancelled) setBootError(true); return; }
      }
      const saved = safeMobileRoute(readMobile("buyer_route", ""));
      if (!cancelled) router.replace(saved && !saved.startsWith("/panel") ? saved : "/marketplace");
    }
    void enter();
    return () => { cancelled = true; };
  }, [native, pathname, router]);

  useEffect(() => {
    if (!native) return;
    document.documentElement.classList.toggle("somos-buyer-space", buyer);
    if (excluded) return;
    const safe = safeMobileRoute(pathname);
    if (safe && !pathname.startsWith("/panel")) writeMobile("buyer_route", safe);
    const back = () => {
      const layer = new Event("somos:back-layer", { cancelable: true });
      window.dispatchEvent(layer);
      if (layer.defaultPrevented) return true;
      // Existing dialogs already expose close buttons; preserve their own cleanup handlers.
      const closeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Cerrar"]')).filter((button) => button.getClientRects().length);
      const close = closeButtons.at(-1);
      if (close) { close.click(); return true; }
      const target = mobileBackTarget(pathname);
      if (!confirmNativeLeave()) return true;
      if (target) { router.replace(target); return true; }
      return false;
    };
    const nativeWindow = window as Window & { somosNativeBack?: () => boolean };
    nativeWindow.somosNativeBack = back;
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!link || new URL(link.href).origin !== window.location.origin || new URL(link.href).pathname === pathname) return;
      if (!confirmNativeLeave()) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", leave, true);
    return () => { delete nativeWindow.somosNativeBack; document.removeEventListener("click", leave, true); };
  }, [native, pathname, router, buyer, excluded]);

  useEffect(() => {
    if (!native) return;
    const sync = () => {
      try {
        setCarts(Object.keys(localStorage).filter((key) => key.startsWith("vendeplus_cart_")).map((key) => ({ slug: key.slice("vendeplus_cart_".length), count: getCartCount(getCart(key.slice("vendeplus_cart_".length))) })).filter((cart) => cart.count > 0 && safeMobileRoute(`/${cart.slug}`)));
      } catch { setCarts([]); }
    };
    sync();
    window.addEventListener("vendeplus-cart-change", sync);
    return () => window.removeEventListener("vendeplus-cart-change", sync);
  }, [native, pathname]);

  if (!native || excluded) return null;
  if (pathname === "/") return <div className="native-start" role="status"><BrandLogo size="lg" priority />{!bootError ? <span className="native-loading-bar" aria-hidden="true" /> : null}<p>{bootError ? "No pudimos recuperar tu acceso." : "Abriendo Somos..."}</p>{bootError ? <><button onClick={() => window.location.reload()}>Reintentar</button><Link href="/marketplace" onClick={() => writeMobile("space", "buy")}>Ir a comprar</Link></> : null}</div>;

  function openProfile() {
    const profile = getCustomerBrowserProfile();
    setName(profile?.name || ""); setPhone(profile?.phone || ""); setIdNumber(profile?.idNumber || ""); setMessage(""); setProfileOpen(true);
  }
  function search() {
    if (pathname !== "/marketplace") { router.push("/marketplace#buscar"); return; }
    window.dispatchEvent(new Event("somos:search"));
  }

  function marketplaceView(view: "inicio" | "promociones") {
    if (pathname === "/marketplace") {
      window.location.hash = view;
      window.dispatchEvent(new Event("hashchange"));
    } else router.push(`/marketplace#${view}`);
  }

  return <>
    <BuyerAuthResume />
    {offline ? <div className="native-connection" role="status"><WifiOff size={17} /><span>Sin conexion. No se enviaran pedidos.</span><button aria-label="Reintentar conexion" onClick={() => { setOffline(!navigator.onLine); router.refresh(); }}><RefreshCw size={19} /></button></div> : null}
    {buyer ? <>
      <header className="native-buyer-header">{pathname !== "/marketplace" ? <Link href="/marketplace" aria-label="Ir al inicio" title="Ir al inicio"><ArrowLeft size={21} /></Link> : null}<Link href="/marketplace" aria-label="Somos, inicio" className="native-brand"><BrandLogo size="sm" priority /></Link><Link href="/panel/login" className="native-business-entry" onClick={() => writeMobile("space", "business")}><Store size={17} /><span>Ingresar a mi negocio</span></Link></header>
      {pathname === "/marketplace" && carts.length ? <div className="native-carts">{carts.map((cart) => <Link key={cart.slug} href={`/${cart.slug}/carrito`}><ShoppingBag size={17} />{cart.slug.replaceAll("-", " ")}<span>{cart.count}</span></Link>)}</div> : null}
      <nav className="native-buyer-nav" aria-label="Comprar"><button onClick={() => marketplaceView("inicio")} aria-current={pathname === "/marketplace" && marketView === "home" ? "page" : undefined}><Home size={21} />Inicio</button><button onClick={search}><Search size={21} />Buscar</button><button onClick={() => marketplaceView("promociones")} aria-current={pathname === "/marketplace" && marketView === "offers" ? "page" : undefined}><Percent size={21} />Promos</button><button onClick={openProfile}><UserRound size={21} />Mis datos</button></nav>
    </> : null}
    {profileOpen ? <div className="native-modal-backdrop" onClick={() => setProfileOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="mobile-profile-title" className="native-profile" onClick={(e) => e.stopPropagation()}>
        <header><h2 id="mobile-profile-title">Mis datos</h2><button aria-label="Cerrar mis datos" onClick={() => setProfileOpen(false)}><X /></button></header>
        <p>Se guardan en este dispositivo para completar tus pedidos. No son una cuenta verificada.</p>
        <form onSubmit={(e) => { e.preventDefault(); const id = getCustomerIdParts(idNumber); setMessage(saveCustomerBrowserProfile(name, phone, id.number ? `${id.type}-${id.number}` : "") ? "Datos guardados en este dispositivo." : "Completa tu nombre y telefono."); }}>
          <label>Nombre<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
          <label>Telefono<input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></label>
          <div className="native-profile-id"><label htmlFor="buyer-id-number">Cedula (opcional)</label><div><select aria-label="Tipo de cedula" value={getCustomerIdParts(idNumber).type} onChange={e => setIdNumber(`${e.target.value}-${getCustomerIdParts(idNumber).number}`)}><option value="V">V</option><option value="E">E</option><option value="J">J</option></select><input id="buyer-id-number" inputMode="numeric" autoComplete="off" value={getCustomerIdParts(idNumber).number} onChange={e => setIdNumber(`${getCustomerIdParts(idNumber).type}-${e.target.value.replace(/\D/g, "")}`)} maxLength={15} /></div></div>
          <button type="submit">Guardar datos</button>
          <button type="button" onClick={() => { clearCustomerBrowserProfile(); setName(""); setPhone(""); setIdNumber(""); setMessage("Nombre, telefono y cedula eliminados de este dispositivo."); }}>Borrar mis datos</button>
          <p role="status">{message}</p>
        </form>
        <FrequentLocation />
        <Link className="buyer-account-link" href="/mi-cuenta" onClick={() => setProfileOpen(false)}><UserRound size={18} />Mi cuenta y pedidos</Link>
      </section>
    </div> : null}
  </>;
}
