import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import "./globals.css";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VendeMas | Compra en negocios locales",
  description: "Explora negocios, arma tu pedido y confirma por WhatsApp.",
  manifest: "/manifest.webmanifest",
  applicationName: "VendeMas",
  appleWebApp: {
    capable: true,
    title: "VendeMas",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#2E3A79",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={nunito.variable} suppressHydrationWarning>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
