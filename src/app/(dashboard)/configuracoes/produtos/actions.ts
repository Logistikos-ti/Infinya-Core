"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConfigSectionAccess, requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { produtoFormSchema } from "@/lib/validations/produtos";

export type ProdutoActionState = {
  success: boolean;
  message: string | null;
  errors?: Partial<
    Record<
      | "depositanteId"
      | "codigoInterno"
      | "sku"
      | "nome"
      | "eanGtin"
      | "categoria"
      | "metodoRetirada"
      | "unidadeEstocagem"
      | "quantidadePorEmbalagem",
      string
    >
  >;
};

export async function saveProdutoAction(
  _prevState: ProdutoActionState,
  formData: FormData,
): Promise<ProdutoActionState> {
  await requireConfigSectionAccess("produtos");

  const quantidadePorEmbalagemRaw = String(formData.get("quantidadePorEmbalagem") ?? "").trim();

  const parsed = produtoFormSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    depositanteId: String(formData.get("depositanteId") ?? "").trim(),
    codigoInterno: String(formData.get("codigoInterno") ?? "").trim().toUpperCase(),
    sku: String(formData.get("sku") ?? "").trim().toUpperCase(),
    nome: String(formData.get("nome") ?? "").trim(),
    eanGtin: String(formData.get("eanGtin") ?? "").trim(),
    categoria: String(formData.get("categoria") ?? "").trim(),
    metodoRetirada: String(formData.get("metodoRetirada") ?? "FEFO"),
    unidadeEstocagem: String(formData.get("unidadeEstocagem") ?? "UNIDADE"),
    quantidadePorEmbalagem: quantidadePorEmbalagemRaw ? Number(quantidadePorEmbalagemRaw) : undefined,
    exigeLote: formData.get("exigeLote") === "on",
    exigeValidade: formData.get("exigeValidade") === "on",
    ativo: formData.get("ativo") === "on",
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      success: false,
      message: "Revise os campos destacados e tente novamente.",
      errors: {
        depositanteId: flattened.depositanteId?.[0] ?? "",
        codigoInterno: flattened.codigoInterno?.[0] ?? "",
        sku: flattened.sku?.[0] ?? "",
        nome: flattened.nome?.[0] ?? "",
        eanGtin: flattened.eanGtin?.[0] ?? "",
        categoria: flattened.categoria?.[0] ?? "",
        metodoRetirada: flattened.metodoRetirada?.[0] ?? "",
        unidadeEstocagem: flattened.unidadeEstocagem?.[0] ?? "",
        quantidadePorEmbalagem: flattened.quantidadePorEmbalagem?.[0] ?? "",
      },
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const payload = {
    depositante_id: parsed.data.depositanteId,
    codigo_interno: parsed.data.codigoInterno,
    codigo_externo: parsed.data.eanGtin || null,
    sku: parsed.data.sku,
    nome: parsed.data.nome,
    categoria: parsed.data.categoria || null,
    metodo_retirada: parsed.data.metodoRetirada,
    unidade_estocagem: parsed.data.unidadeEstocagem,
    quantidade_por_embalagem:
      parsed.data.unidadeEstocagem === "CAIXA" || parsed.data.unidadeEstocagem === "PACK"
        ? parsed.data.quantidadePorEmbalagem ?? null
        : null,
    exige_lote: parsed.data.exigeLote,
    exige_validade: parsed.data.exigeValidade,
    ativo: parsed.data.ativo,
  };

  if (parsed.data.id) {
    const { error } = await adminSupabase.from("produtos").update(payload).eq("id", parsed.data.id);

    if (error) {
      return {
        success: false,
        message: `Não foi possível atualizar o produto: ${error.message}`,
      };
    }

    revalidatePath("/configuracoes/produtos");
    revalidatePath(`/configuracoes/produtos/${parsed.data.id}/editar`);
    redirect("/configuracoes/produtos?feedback=salvo");
  }

  const { error } = await adminSupabase.from("produtos").insert(payload);

  if (error) {
    return {
      success: false,
      message: `Não foi possível criar o produto: ${error.message}`,
    };
  }

  revalidatePath("/configuracoes/produtos");
  redirect("/configuracoes/produtos?feedback=criado");
}

export async function toggleProdutoStatusAction(formData: FormData) {
  await requireConfigSectionAccess("produtos");

  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("nextActive") ?? "").trim() === "true";

  if (!id) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.from("produtos").update({ ativo: nextActive }).eq("id", id);
  revalidatePath("/configuracoes/produtos");
}

export async function deleteProdutoAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/configuracoes/produtos?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();

  const dependencyChecks = await Promise.all([
    adminSupabase
      .from("pedidos_recebimento_itens")
      .select("id", { count: "exact", head: true })
      .eq("produto_id", id),
    adminSupabase
      .from("estoque")
      .select("id", { count: "exact", head: true })
      .eq("produto_id", id),
  ]);

  const totalDependencies = dependencyChecks.reduce((total, query) => total + (query.count ?? 0), 0);

  if (totalDependencies > 0) {
    redirect("/configuracoes/produtos?feedback=vinculos");
  }

  const { error } = await adminSupabase.from("produtos").delete().eq("id", id);

  if (error) {
    redirect("/configuracoes/produtos?feedback=erro");
  }

  revalidatePath("/configuracoes/produtos");
  redirect("/configuracoes/produtos?feedback=excluido");
}
