"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Home, Search, UserRound, Store, ShoppingBag, X, WifiOff, RefreshCw, Percent, MapPin, LogIn, ShieldCheck, Trash2, CircleCheck, ChevronRight, Truck } from "lucide-react";
import { BuyerAuthResume } from "@/components/buyer/BuyerAuthResume";
import { confirmNativeLeave, useNativeApp, useNativeBackLayer } from "@/hooks/use-native-app";
import { mobileBackTarget, safeMobileRoute, writeMobile } from "@/lib/mobile/state";
import { getCart, getCartCount } from "@/lib/cart";
import { clearCustomerBrowserProfile, getCustomerBrowserProfile, getCustomerIdParts, saveCustomerBrowserProfile } from "@/lib/customer-browser-profile";
import { getBuyerClient, signInBuyerWithGoogle } from "@/lib/buyer/client";
import { clearFrequentLocation, normalizeFrequentLocation, readFrequentLocation, saveFrequentLocation } from "@/lib/mobile/frequent-location";
import { BrandLogo } from "@/components/public/BrandLogo";
import type { DeliveryLocation } from "@/types";

const LocationPicker = dynamic(() => import("@/components/public/LocationPicker").then(mod => mod.LocationPicker), { ssr: false });

export function NativeExperience() {
  const native = useNativeApp();
  const pathname = usePathname();
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [message, setMessage] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationName, setLocationName] = useState("Casa");
  const [locationReference, setLocationReference] = useState("");
  const [frequentLocation, setFrequentLocation] = useState<DeliveryLocation | null>(null);
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
    if (!native) return;
    const auth = getBuyerClient();
    if (!auth) return;
    void auth.auth.getSession().then(({ data }) => setBuyerEmail(data.session?.user.email || ""));
    const { data } = auth.auth.onAuthStateChange((_event, session) => {
      setBuyerEmail(session?.user.email || "");
      setAuthBusy(false);
    });
    return () => data.subscription.unsubscribe();
  }, [native]);

  useEffect(() => {
    if (!native) return;
    document.documentElement.classList.toggle("somos-buyer-space", buyer);
    const safe = safeMobileRoute(pathname);
    if (!excluded && safe && !pathname.startsWith("/panel")) writeMobile("buyer_route", safe);
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
  if (pathname === "/") {
    const profiles = [
      { key: "buy", title: "Cliente", detail: "Explora comercios y realiza pedidos", href: "/marketplace", icon: ShoppingBag },
      { key: "business", title: "Comercio", detail: "Gestiona productos, pedidos e impresion", href: "/panel/login", icon: Store },
      { key: "transport", title: "Empresa delivery", detail: "Administra servicios, comercios y repartidores", href: "/transporte/panel", icon: Truck },
    ] as const;

    return <main className="native-start native-profile-select">
      <header>
        <p>Elige cómo deseas ingresar</p>
      </header>
      <section aria-label="Perfiles de acceso">
        {profiles.map((profile) => {
          const Icon = profile.icon;
          return <button key={profile.key} type="button" onClick={() => { writeMobile("space", profile.key); router.replace(profile.href); }}>
            <span><Icon size={24} /></span>
            <span><strong>{profile.title}</strong><small>{profile.detail}</small></span>
            <ChevronRight size={21} />
          </button>;
        })}
      </section>
      <footer className="native-profile-footer">
        <small>Puedes cambiar de perfil cuando lo necesites.</small>
        <BrandLogo size="lg" priority />
      </footer>
    </main>;
  }

  function openProfile() {
    const profile = getCustomerBrowserProfile();
    const savedLocation = readFrequentLocation();
    setName(profile?.name || ""); setPhone(profile?.phone || ""); setIdNumber(profile?.idNumber || ""); setMessage(""); setProfileOpen(true);
    setLocationEnabled(Boolean(savedLocation));
    setLocationName(savedLocation?.name || "Casa");
    setLocationReference(savedLocation?.reference || "");
    setFrequentLocation(savedLocation?.location || null);
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
      <header className="native-buyer-header">{pathname !== "/marketplace" ? <Link href="/marketplace" aria-label="Ir al inicio" title="Ir al inicio"><ArrowLeft size={21} /></Link> : null}<Link href="/marketplace" aria-label="Somos, inicio" className="native-brand"><BrandLogo variant="white" size="sm" priority /></Link><Link href="/" className="native-business-entry"><UserRound size={17} /><span>Cambiar perfil</span></Link></header>
      {pathname === "/marketplace" && carts.length ? <div className="native-carts">{carts.map((cart) => <Link key={cart.slug} href={`/${cart.slug}/carrito`}><ShoppingBag size={17} />{cart.slug.replaceAll("-", " ")}<span>{cart.count}</span></Link>)}</div> : null}
      <nav className="native-buyer-nav" aria-label="Comprar"><button onClick={() => marketplaceView("inicio")} aria-current={pathname === "/marketplace" && marketView === "home" ? "page" : undefined}><Home size={21} />Inicio</button><button onClick={search}><Search size={21} />Buscar</button><button onClick={() => marketplaceView("promociones")} aria-current={pathname === "/marketplace" && marketView === "offers" ? "page" : undefined}><Percent size={21} />Promos</button><button onClick={openProfile}><UserRound size={21} />Mis datos</button></nav>
    </> : null}
    {profileOpen ? <div className="native-modal-backdrop" onClick={() => setProfileOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="mobile-profile-title" className="native-profile" onClick={(e) => e.stopPropagation()}>
        <header><h2 id="mobile-profile-title">Mis datos</h2><button aria-label="Cerrar mis datos" onClick={() => setProfileOpen(false)}><X /></button></header>
        <form className="native-profile-form" onSubmit={(e) => {
          e.preventDefault();
          const id = getCustomerIdParts(idNumber);
          const locationDraft = locationEnabled ? normalizeFrequentLocation({ name: locationName, reference: locationReference, location: frequentLocation }) : null;
          if (!name.trim() || !phone.trim()) { setMessage("Completa tu nombre y telefono."); return; }
          if (locationEnabled && !locationDraft) { setMessage("Marca el punto de tu ubicacion frecuente."); return; }
          const profileSaved = saveCustomerBrowserProfile(name, phone, id.number ? `${id.type}-${id.number}` : "");
          const locationSaved = !locationEnabled || saveFrequentLocation(locationDraft);
          setMessage(profileSaved && locationSaved ? "Cambios guardados en este dispositivo." : "No pudimos guardar los cambios.");
        }}>
          <div className="native-profile-status" data-verified={Boolean(buyerEmail)}><span><UserRound size={18} /></span><div><strong>{buyerEmail ? "Usuario validado" : "Invitado"}</strong>{buyerEmail ? <small>{buyerEmail}</small> : <small>Compra sin una cuenta vinculada</small>}</div>{buyerEmail ? <ShieldCheck size={20} /> : null}</div>
          <fieldset><legend>Datos para tus pedidos</legend>
            <label>Nombre<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
            <label>Telefono<input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></label>
            <div className="native-profile-id"><label htmlFor="buyer-id-number">Cedula (opcional)</label><div><select aria-label="Tipo de cedula" value={getCustomerIdParts(idNumber).type} onChange={e => setIdNumber(`${e.target.value}-${getCustomerIdParts(idNumber).number}`)}><option value="V">V</option><option value="E">E</option><option value="J">J</option></select><input id="buyer-id-number" inputMode="numeric" autoComplete="off" value={getCustomerIdParts(idNumber).number} onChange={e => setIdNumber(`${getCustomerIdParts(idNumber).type}-${e.target.value.replace(/\D/g, "")}`)} maxLength={15} /></div></div>
          </fieldset>
          <fieldset><legend><MapPin size={17} />Ubicacion frecuente</legend>
            {!locationEnabled ? <button className="native-profile-action native-profile-location-add" type="button" onClick={() => setLocationEnabled(true)}><span><MapPin size={19} /></span><strong>Agregar ubicacion</strong><ChevronRight size={18} /></button> : <div className="native-profile-location">
              <label>Nombre de la ubicacion<input value={locationName} onChange={event => setLocationName(event.target.value)} maxLength={40} placeholder="Casa o trabajo" /></label>
              <label>Referencia (opcional)<textarea value={locationReference} onChange={event => setLocationReference(event.target.value)} maxLength={500} rows={2} /></label>
              <LocationPicker storeLatitude={frequentLocation?.latitude ?? 8} storeLongitude={frequentLocation?.longitude ?? -66} value={frequentLocation} onChange={setFrequentLocation} mode="saved" pointName="Mi ubicacion" />
              <button className="native-profile-location-remove" type="button" onClick={() => { clearFrequentLocation(); setLocationEnabled(false); setFrequentLocation(null); setLocationReference(""); setMessage("Ubicacion frecuente eliminada."); }}><Trash2 size={17} />Quitar ubicacion</button>
            </div>}
          </fieldset>
          <fieldset><legend><CircleCheck size={17} />Validar cuenta</legend>{buyerEmail ? <Link className="buyer-account-link native-profile-action" href="/mi-cuenta" onClick={() => setProfileOpen(false)}><span><ShoppingBag size={19} /></span><strong>Ver mis pedidos</strong><ChevronRight size={18} /></Link> : <button className="native-profile-action native-profile-login" type="button" disabled={authBusy} onClick={async () => { setAuthBusy(true); setMessage(""); try { await signInBuyerWithGoogle(); } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos ingresar con Google."); setAuthBusy(false); } }}><span>{authBusy ? <RefreshCw className="animate-spin" size={19} /> : <LogIn size={19} />}</span><strong>{authBusy ? "Abriendo Google..." : "Validar con Google"}</strong><ChevronRight size={18} /></button>}</fieldset>
          {message ? <p role="status" className="native-profile-message">{message}</p> : null}
          <button className="native-profile-save" type="submit">Guardar cambios</button>
          <button className="native-profile-clear" type="button" onClick={() => { clearCustomerBrowserProfile(); setName(""); setPhone(""); setIdNumber(""); setMessage("Nombre, telefono y cedula eliminados de este dispositivo."); }}>Borrar datos personales</button>
        </form>
      </section>
    </div> : null}
  </>;
}
