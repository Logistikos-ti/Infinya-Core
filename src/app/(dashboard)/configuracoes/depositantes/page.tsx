import { redirect } from "next/navigation";

export default function ConfiguracoesDepositantesPage() {
  redirect("/configuracoes?tab=depositantes");
}
