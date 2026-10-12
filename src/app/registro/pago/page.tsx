import type { Metadata } from "next";
import { SetupPaymentForm } from "@/components/public/SetupPaymentForm";

export const metadata: Metadata = { title: "Reportar pago | SOMOS", robots: { index: false, follow: false } };
export default function RegistrationPaymentPage() { return <SetupPaymentForm />; }
