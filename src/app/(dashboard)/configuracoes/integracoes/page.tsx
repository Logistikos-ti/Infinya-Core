import { redirect } from "next/navigation";

export default function IntegracoesRedirect() {
  redirect("/configuracoes?tab=integracoes");
}
