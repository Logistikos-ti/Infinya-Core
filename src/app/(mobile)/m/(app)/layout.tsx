import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { MobileAppShell } from "@/components/mobile/mobile-app-shell";

export default async function MobileProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUserContext();

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  return <MobileAppShell user={user}>{children}</MobileAppShell>;
}
