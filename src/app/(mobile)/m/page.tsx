import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { getDefaultMobileRoute } from "@/lib/mobile";

export default async function MobileEntryPage() {
  const user = await getCurrentUserContext();

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  redirect(getDefaultMobileRoute(user));
}
