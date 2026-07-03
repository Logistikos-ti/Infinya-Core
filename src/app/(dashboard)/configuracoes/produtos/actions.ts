"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConfigSectionAccess } from "@/lib/auth";
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
  const resolvedInternalCode = resolveProductInternalCode(parsed.data.codigoInterno, parsed.data.nome);
  const resolvedSku = resolveProductSku(parsed.data.sku, resolvedInternalCode);
  const normalizedEan = normalizeBarcode(parsed.data.eanGtin);

  if (normalizedEan) {
    const duplicateBarcodeQuery = adminSupabase
      .from("produtos")
      .select("id, nome, depositante:depositantes(nome)")
      .eq("codigo_externo", normalizedEan)
      .limit(1);

    if (parsed.data.id) {
      duplicateBarcodeQuery.neq("id", parsed.data.id);
    }

    const { data: duplicateBarcode, error: duplicateBarcodeError } = await duplicateBarcodeQuery.maybeSingle();

    if (duplicateBarcodeError) {
      return {
        success: false,
        message: `Nao foi possivel validar o EAN/GTIN: ${duplicateBarcodeError.message}`,
      };
    }

    if (duplicateBarcode) {
      const depositanteNome = extractDepositanteName(duplicateBarcode.depositante);
      return {
        success: false,
        message: `Ja existe um produto com esse EAN/GTIN${depositanteNome ? ` no depositante ${depositanteNome}` : ""}: ${duplicateBarcode.nome}.`,
        errors: {
          eanGtin: "Este EAN/GTIN ja esta cadastrado.",
        },
      };
    }
  }

  const payload = {
    depositante_id: parsed.data.depositanteId,
    codigo_interno: resolvedInternalCode,
    codigo_externo: normalizedEan,
    sku: resolvedSku,
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
    const updateResult = await updateProductWithFallback(adminSupabase, parsed.data.id, payload);

    if (updateResult.error) {
      return {
        success: false,
        message: humanizeProductPersistenceError("atualizar", updateResult.error.message),
      };
    }

    revalidatePath("/configuracoes/produtos");
    revalidatePath(`/configuracoes/produtos/${parsed.data.id}/editar`);
    redirect("/configuracoes/produtos?feedback=salvo");
  }

  const insertResult = await insertProductWithFallback(adminSupabase, payload);

  if (insertResult.error) {
    return {
      success: false,
      message: humanizeProductPersistenceError("criar", insertResult.error.message),
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
  await requireConfigSectionAccess("produtos");

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
      .from("pedidos_expedicao_itens")
      .select("id", { count: "exact", head: true })
      .eq("produto_id", id),
    adminSupabase
      .from("estoque")
      .select("id", { count: "exact", head: true })
      .eq("produto_id", id),
    adminSupabase
      .from("movimentacoes_estoque")
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

async function updateProductWithFallback(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  payload: Record<string, unknown>,
) {
  const result = await adminSupabase.from("produtos").update(payload).eq("id", id);

  if (result.error && isMissingPackagingColumnError(result.error.message)) {
    return adminSupabase.from("produtos").update(withoutPackagingQuantity(payload)).eq("id", id);
  }

  return result;
}

async function insertProductWithFallback(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
) {
  const result = await adminSupabase.from("produtos").insert(payload);

  if (result.error && isMissingPackagingColumnError(result.error.message)) {
    return adminSupabase.from("produtos").insert(withoutPackagingQuantity(payload));
  }

  return result;
}

function isMissingPackagingColumnError(message: string) {
  return message.includes("quantidade_por_embalagem");
}

function withoutPackagingQuantity<T extends Record<string, unknown>>(payload: T) {
  const rest = { ...payload };
  delete rest.quantidade_por_embalagem;
  return rest;
}

function resolveProductInternalCode(rawValue: string | undefined, productName: string) {
  const normalized = (rawValue ?? "").trim().toUpperCase();

  if (normalized) {
    return normalized;
  }

  const baseName = productName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);

  return `${baseName || "PRODUTO"}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function resolveProductSku(rawValue: string | undefined, internalCode: string) {
  const normalized = (rawValue ?? "").trim().toUpperCase();
  return normalized || internalCode;
}

function normalizeBarcode(value: string | undefined) {
  const normalized = (value ?? "").trim();
  return normalized || null;
}

function extractDepositanteName(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.nome === "string" ? first.nome : null;
  }

  if (value && typeof value === "object" && "nome" in value) {
    const nome = (value as { nome?: unknown }).nome;
    return typeof nome === "string" ? nome : null;
  }

  return null;
}

function humanizeProductPersistenceError(
  action: "criar" | "atualizar",
  message: string,
) {
  if (
    message.includes('invalid input value for enum unidade_estocagem') &&
    message.includes('"PACK"')
  ) {
    return `Nao foi possivel ${action} o produto porque o banco online ainda nao recebeu a unidade PACK. Rode a migration de PACK no Supabase e tente novamente.`;
  }

  return `Nao foi possivel ${action} o produto: ${message}`;
}
