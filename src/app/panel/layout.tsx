import type { Metadata } from "next";
import { PanelAuthProvider } from "@/components/panel/PanelAuthProvider";
import { PanelFrame } from "@/components/panel/PanelFrame";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelAuthProvider>
      <PanelFrame>{children}</PanelFrame>
    </PanelAuthProvider>
  );
}
