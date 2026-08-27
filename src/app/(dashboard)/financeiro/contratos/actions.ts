"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { contratoCobrancaFormSchema } from "@/lib/validations/contratos-cobranca";

const FIELDS = [
  "depositante_id",
  "taxa_fulfillment",
  "minimo_fulfillment",
  "tarifa_posicao",
  "valor_ponto_coleta",
  "valor_impressao_nf",
  "valor_carta_correcao",
  "valor_outro_documento",
  "taxa_frete_fixa",
  "taxa_frete_percentual",
  "tarifa_recebimento",
  "valor_logistica_reversa",
  "valor_software",
  "qtd_refrigeradores",
  "valor_unitario_refrigerador",
  "tipo_contrato",
  "responsavel",
  "vigencia_inicio",
  "vigencia_fim",
  "observacoes",
] as const;

export type ContratoActionState = {
  success: boolean;
  message: string | null;
  errors?: Partial<Record<string, string>>;
};

export async function saveContratoAction(
  _prevState: ContratoActionState,
  formData: FormData,
): Promise<ContratoActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const raw: Record<string, unknown> = {};
  raw.id = String(formData.get("id") ?? "").trim() || undefined;
  for (const f of FIELDS) {
    raw[f] = String(formData.get(f) ?? "").trim();
  }
  raw.ativo = formData.get("ativo") === "on";

  const parsed = contratoCobrancaFormSchema.safeParse(raw);

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [key, msgs] of Object.entries(flattened)) {
      if (msgs?.[0]) errors[key] = msgs[0];
    }
    return {
      success: false,
      message: "Revise os campos destacados e tente novamente.",
      errors,
    };
  }

  const admin = createSupabaseAdminClient();
  const { id, vigencia_inicio, vigencia_fim, observacoes, responsavel, ...rest } = parsed.data;

  const emailsList = formData
    .getAll("emails_cobranca")
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v.includes("@"));

  const marketplacesPontoColeta = formData
    .getAll("marketplaces_ponto_coleta")
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean);

  const payload = {
    ...rest,
    vigencia_inicio: vigencia_inicio || null,
    vigencia_fim: vigencia_fim || null,
    observacoes: observacoes || null,
    responsavel: responsavel || null,
    emails_cobranca: emailsList.length > 0 ? emailsList : null,
    marketplaces_ponto_coleta: marketplacesPontoColeta,
  };

  if (id) {
    const { depositante_id: _, ...updatePayload } = payload;
    const { error } = await admin
      .from("contratos_cobranca")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      return { success: false, message: `Erro ao atualizar: ${error.message}` };
    }

    revalidatePath("/financeiro");
    return { success: true, message: null };
  }

  const { error } = await admin
    .from("contratos_cobranca")
    .upsert(payload, { onConflict: "depositante_id" })
    .select()
    .single();

  if (error) {
    return { success: false, message: `Erro ao criar: ${error.message}` };
  }

  revalidatePath("/financeiro");
  return { success: true, message: null };
}
