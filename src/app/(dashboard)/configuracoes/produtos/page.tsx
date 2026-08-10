import { redirect } from "next/navigation";

export default function ProdutosRedirect() {
  redirect("/configuracoes?tab=produtos");
}
