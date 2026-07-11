import type { Metadata } from "next";
import { PanelAuthProvider } from "@/components/panel/PanelAuthProvider";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PanelAuthProvider>{children}</PanelAuthProvider>;
}
