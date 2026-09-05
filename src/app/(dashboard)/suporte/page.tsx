import { Suspense } from "react";
import { SupportView } from "@/components/support/support-view";
import { requireRoleAccess } from "@/lib/auth";

export default async function SupportOperationsPage() {
  await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  // SupportView usa useSearchParams (abre o chamado vindo do sino de
  // notificações via ?chamado=) -- precisa de um Suspense boundary.
  return (
    <Suspense fallback={null}>
      <SupportView />
    </Suspense>
  );
}
