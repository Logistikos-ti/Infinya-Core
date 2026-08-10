import { redirect } from "next/navigation";

export default function EnderecosRedirect() {
  redirect("/configuracoes?tab=enderecos");
}
