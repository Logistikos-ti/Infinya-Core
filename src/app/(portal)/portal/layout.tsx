import { PortalChrome } from "@/components/portal/portal-chrome";
import { requireRoleAccess } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleAccess(["DEPOSITANTE"]);
  return <PortalChrome user={user}>{children}</PortalChrome>;
}
