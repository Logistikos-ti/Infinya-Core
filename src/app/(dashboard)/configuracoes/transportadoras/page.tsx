import { redirect } from "next/navigation";

export default function TransportadorasRedirect() {
  redirect("/configuracoes?tab=transportadoras");
}
