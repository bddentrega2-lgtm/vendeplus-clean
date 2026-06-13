import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { PanelAuthProvider } from "@/components/panel/PanelAuthProvider";
import "./globals.css";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vende+ | Catálogo inteligente",
  description: "Vende más. Cobra mejor. Gestiona tus entregas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={nunito.variable} suppressHydrationWarning>
        <PanelAuthProvider>{children}</PanelAuthProvider>
      </body>
    </html>
  );
}
