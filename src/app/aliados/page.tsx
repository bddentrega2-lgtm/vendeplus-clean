import type { Metadata } from "next";
import { AffiliateDashboard } from "@/components/affiliates/AffiliateDashboard";

export const metadata: Metadata = { title: "Aliados | SOMOS", robots: { index: false, follow: false } };
export default function AffiliatePage() { return <AffiliateDashboard />; }
