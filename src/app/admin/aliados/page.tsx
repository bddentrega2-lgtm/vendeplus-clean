import { AdminShell } from "@/components/admin/AdminShell";
import { AdminAffiliatesManager } from "@/components/admin/AdminAffiliatesManager";

export default function AdminAffiliatesPage() {
  return <AdminShell active="/admin/aliados" title="Aliados" subtitle="Codigos, referidos y liquidaciones."><AdminAffiliatesManager /></AdminShell>;
}
