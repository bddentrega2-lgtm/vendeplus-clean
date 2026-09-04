import { UpdatePasswordForm } from "@/components/panel/UpdatePasswordForm";

export default function TransporteSeguridadPage() {
  return (
    <UpdatePasswordForm
      eyebrow="Empresa delivery"
      description="Escribe una nueva contraseña para proteger el acceso al panel de tu empresa delivery."
      loginHref="/transporte/panel"
    />
  );
}
