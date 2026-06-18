"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function updateShippingOrderAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/expedicao?feedback=erro");
  }

  const status = String(formData.get("status") ?? "").trim().toUpperCase();
  const numeroPedido = String(formData.get("numeroPedido") ?? "").trim();
  const numeroLoja = String(formData.get("numeroLoja") ?? "").trim();
  const clienteNome = String(formData.get("clienteNome") ?? "").trim();
  const clienteDocumento = String(formData.get("clienteDocumento") ?? "").trim();
  const clienteCidade = String(formData.get("clienteCidade") ?? "").trim();
  const clienteUf = String(formData.get("clienteUf") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const previsaoEnvioEm = String(formData.get("previsaoEnvioEm") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  const allowedStatuses = new Set([
    "NOVO",
    "EM_SEPARACAO",
    "SEPARADO",
    "EM_CONFERENCIA",
    "CONFERIDO",
    "PRONTO_ROMANEIO",
    "EXPEDIDO",
    "CANCELADO",
  ]);

  if (!allowedStatuses.has(status)) {
    redirect(`/expedicao/${id}/editar?feedback=status-invalido`);
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status,
      numero_pedido: numeroPedido || null,
      numero_loja: numeroLoja || null,
      cliente_nome: clienteNome || null,
      cliente_documento: clienteDocumento || null,
      cliente_cidade: clienteCidade || null,
      cliente_uf: clienteUf || null,
      previsao_envio_em: previsaoEnvioEm || null,
      observacoes: observacoes || null,
    })
    .eq("id", id);

  if (error) {
    redirect(`/expedicao/${id}/editar?feedback=erro`);
  }

  revalidatePath("/expedicao");
  revalidatePath(`/expedicao/${id}`);
  revalidatePath(`/expedicao/${id}/editar`);
  redirect(`/expedicao/${id}?feedback=salvo`);
}
