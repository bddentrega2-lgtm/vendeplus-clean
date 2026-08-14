import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { PUBLIC_SITE_URL } from "@/lib/public-url";
import "./globals.css";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: "Somos | Comercios y logistica en tu ciudad",
  description:
    "Somos conecta a los venezolanos con sus comercios favoritos y las mejores empresas logisticas de su ciudad.",
  manifest: "/manifest.webmanifest",
  applicationName: "Somos",
  icons: {
    icon: {
      url: "/brand/new-somos-preview/favicon-preview-32.png",
      type: "image/png",
      sizes: "32x32",
    },
    apple: {
      url: "/brand/new-somos-preview/apple-touch-icon-preview.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
  appleWebApp: {
    capable: true,
    title: "Somos",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F464C",
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
