import { SupportView } from "@/components/support/support-view";
import { requireRoleAccess } from "@/lib/auth";

export default async function SupportOperationsPage() {
  await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  return <SupportView />;
}
