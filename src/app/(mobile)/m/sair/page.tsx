import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MobileLogoutPage() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/m/login");
}
