"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConfigSectionAccess } from "@/lib/auth";
import { normalizeCommercialKitRuleDrafts } from "@/lib/commercial-kit-rules";
import { normalizeProductKitDrafts } from "@/lib/product-kits";
import {
  allowedProdutoImageMimeTypes,
  maxProdutoImageFileSizeBytes,
  produtosImagesBucketName,
  sanitizeFileName,
} from "@/lib/storage";
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
      | "fornecedor"
      | "categoria"
      | "tipoProduto"
      | "metodoRetirada"
      | "unidadeEstocagem"
      | "quantidadePorEmbalagem"
      | "descricao"
      | "pesoKg"
      | "alturaCm"
      | "larguraCm"
      | "comprimentoCm"
      | "qtdMinima"
      | "qtdMaxima"
      | "pontoReposicao"
      | "custoReposicao"
      | "imageFile",
      string
    >
  >;
};

export async function saveProdutoAction(
  _prevState: ProdutoActionState,
  formData: FormData,
): Promise<ProdutoActionState> {
  const productKitsEnabled = false;
  await requireConfigSectionAccess("produtos");
  const returnPath = normalizeRedirectPath(String(formData.get("returnPath") ?? "").trim());

  const quantidadePorEmbalagemRaw = String(formData.get("quantidadePorEmbalagem") ?? "").trim();
  const kitComponentIds = formData.getAll("kitComponentProductId").map((value) => String(value));
  const kitComponentQuantities = formData
    .getAll("kitComponentQuantity")
    .map((value) => String(value));
  const commercialKitMatchTexts = formData
    .getAll("commercialKitMatchText")
    .map((value) => String(value));
  const commercialKitQuantities = formData
    .getAll("commercialKitQuantity")
    .map((value) => String(value));

  const parsed = produtoFormSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    depositanteId: String(formData.get("depositanteId") ?? "").trim(),
    codigoInterno: String(formData.get("codigoInterno") ?? "").trim().toUpperCase(),
    sku: String(formData.get("sku") ?? "").trim().toUpperCase(),
    nome: String(formData.get("nome") ?? "").trim(),
    eanGtin: String(formData.get("eanGtin") ?? "").trim(),
    fornecedor: String(formData.get("fornecedor") ?? "").trim(),
    categoria: String(formData.get("categoria") ?? "").trim(),
    tipoProduto: String(formData.get("tipoProduto") ?? "SIMPLES"),
    metodoRetirada: String(formData.get("metodoRetirada") ?? "FEFO"),
    unidadeEstocagem: String(formData.get("unidadeEstocagem") ?? "UNIDADE"),
    quantidadePorEmbalagem: quantidadePorEmbalagemRaw ? Number(quantidadePorEmbalagemRaw) : undefined,
    descricao: String(formData.get("descricao") ?? "").trim(),
    pesoKg: String(formData.get("pesoKg") ?? "").trim() || undefined,
    alturaCm: String(formData.get("alturaCm") ?? "").trim() || undefined,
    larguraCm: String(formData.get("larguraCm") ?? "").trim() || undefined,
    comprimentoCm: String(formData.get("comprimentoCm") ?? "").trim() || undefined,
    qtdMinima: String(formData.get("qtdMinima") ?? "").trim() || undefined,
    qtdMaxima: String(formData.get("qtdMaxima") ?? "").trim() || undefined,
    pontoReposicao: String(formData.get("pontoReposicao") ?? "").trim() || undefined,
    custoReposicao: String(formData.get("custoReposicao") ?? "").trim() || undefined,
    exigeLote: parseBooleanFormValue(formData.get("exigeLote")),
    exigeValidade: parseBooleanFormValue(formData.get("exigeValidade")),
    ativo: parseBooleanFormValue(formData.get("ativo"), true),
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
        fornecedor: flattened.fornecedor?.[0] ?? "",
        categoria: flattened.categoria?.[0] ?? "",
        tipoProduto: flattened.tipoProduto?.[0] ?? "",
        metodoRetirada: flattened.metodoRetirada?.[0] ?? "",
        unidadeEstocagem: flattened.unidadeEstocagem?.[0] ?? "",
        quantidadePorEmbalagem: flattened.quantidadePorEmbalagem?.[0] ?? "",
        descricao: flattened.descricao?.[0] ?? "",
        pesoKg: flattened.pesoKg?.[0] ?? "",
        alturaCm: flattened.alturaCm?.[0] ?? "",
        larguraCm: flattened.larguraCm?.[0] ?? "",
        comprimentoCm: flattened.comprimentoCm?.[0] ?? "",
        qtdMinima: flattened.qtdMinima?.[0] ?? "",
        qtdMaxima: flattened.qtdMaxima?.[0] ?? "",
        pontoReposicao: flattened.pontoReposicao?.[0] ?? "",
        custoReposicao: flattened.custoReposicao?.[0] ?? "",
      },
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const resolvedInternalCode = resolveProductInternalCode(parsed.data.codigoInterno, parsed.data.nome);
  const resolvedSku = resolveProductSku(parsed.data.sku, resolvedInternalCode);
  const normalizedEan = normalizeBarcode(parsed.data.eanGtin);
  const currentImageUrl = String(formData.get("currentImageUrl") ?? "").trim() || null;
  const currentImageStoragePath =
    String(formData.get("currentImageStoragePath") ?? "").trim() || null;
  const removeImage = formData.get("removeImage") === "on";
  const imageFile = formData.get("imageFile");
  const normalizedKitComponents = productKitsEnabled
    ? normalizeProductKitDrafts(kitComponentIds, kitComponentQuantities)
    : [];
  const normalizedCommercialKitRules = normalizeCommercialKitRuleDrafts(
    commercialKitMatchTexts,
    commercialKitQuantities,
  );

  if (productKitsEnabled && parsed.data.tipoProduto === "KIT" && normalizedKitComponents.length === 0) {
    return {
      success: false,
      message: "Adicione ao menos um componente para salvar o kit.",
      errors: {
        tipoProduto: "Kit precisa de componentes.",
      },
    };
  }

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

  const imageValidationError =
    imageFile instanceof File && imageFile.size > 0 ? validateProdutoImageFile(imageFile) : null;

  if (imageValidationError) {
    return {
      success: false,
      message: "Revise os campos destacados e tente novamente.",
      errors: {
        imageFile: imageValidationError,
      },
    };
  }

  const imageUploadResult = await resolveProdutoImageUpload({
    adminSupabase,
    depositanteId: parsed.data.depositanteId,
    productCode: resolvedInternalCode,
    currentImageUrl,
    currentImageStoragePath,
    removeImage,
    imageFile,
  });

  if (imageUploadResult.error) {
    return {
      success: false,
      message: imageUploadResult.error,
      errors: {
        imageFile: imageUploadResult.error,
      },
    };
  }

  const payload = {
    depositante_id: parsed.data.depositanteId,
    codigo_interno: resolvedInternalCode,
    codigo_externo: normalizedEan,
    sku: resolvedSku,
    nome: parsed.data.nome,
    fornecedor: parsed.data.fornecedor || null,
    categoria: parsed.data.categoria || null,
    metodo_retirada: parsed.data.metodoRetirada,
    unidade_estocagem: parsed.data.unidadeEstocagem,
    quantidade_por_embalagem:
      parsed.data.unidadeEstocagem === "CAIXA" || parsed.data.unidadeEstocagem === "PACK"
        ? parsed.data.quantidadePorEmbalagem ?? null
        : null,
    descricao: parsed.data.descricao || null,
    peso_kg: parsed.data.pesoKg ?? null,
    altura_cm: parsed.data.alturaCm ?? null,
    largura_cm: parsed.data.larguraCm ?? null,
    comprimento_cm: parsed.data.comprimentoCm ?? null,
    qtd_minima: parsed.data.qtdMinima ?? null,
    qtd_maxima: parsed.data.qtdMaxima ?? null,
    ponto_reposicao: parsed.data.pontoReposicao ?? null,
    custo_reposicao: parsed.data.custoReposicao ?? null,
    imagem_principal_url: imageUploadResult.imageUrl,
    imagem_principal_storage_path: imageUploadResult.imageStoragePath,
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

    if (!updateResult.data?.id) {
      return {
        success: false,
        message:
          "Nao foi possivel confirmar a atualizacao do produto. Ele pode ter sido removido ou ficado indisponivel durante a edicao. Atualize a lista e tente novamente.",
      };
    }

    if (productKitsEnabled) {
      const componentsError = await syncKitComponents(
        adminSupabase,
        parsed.data.id,
        parsed.data.depositanteId,
        parsed.data.tipoProduto,
        normalizedKitComponents,
      );

      if (componentsError) {
        return {
          success: false,
          message: componentsError,
        };
      }
    }

    const commercialRulesError = await syncCommercialKitRules(
      adminSupabase,
      parsed.data.id,
      parsed.data.depositanteId,
      normalizedCommercialKitRules,
    );

    if (commercialRulesError) {
      return {
        success: false,
        message: commercialRulesError,
      };
    }

    revalidatePath("/configuracoes/produtos");
    revalidatePath("/m/produtos");
    revalidatePath(`/configuracoes/produtos/${parsed.data.id}/editar`);
    revalidatePath(`/m/produtos/${parsed.data.id}/editar`);
    if (returnPath) {
      revalidatePath(returnPath);
      redirect(`${returnPath}?feedback=salvo`);
    }

    redirect("/configuracoes/produtos?feedback=salvo");
  }

  const insertResult = await insertProductWithFallback(adminSupabase, payload);

  if (insertResult.error || !insertResult.data?.id) {
    return {
      success: false,
      message: humanizeProductPersistenceError("criar", insertResult.error?.message ?? "Produto sem identificador retornado."),
    };
  }

  if (productKitsEnabled) {
    const componentsError = await syncKitComponents(
      adminSupabase,
      insertResult.data.id,
      parsed.data.depositanteId,
      parsed.data.tipoProduto,
      normalizedKitComponents,
    );

    if (componentsError) {
      return {
        success: false,
        message: componentsError,
      };
    }
  }

  const commercialRulesError = await syncCommercialKitRules(
    adminSupabase,
    insertResult.data.id,
    parsed.data.depositanteId,
    normalizedCommercialKitRules,
  );

  if (commercialRulesError) {
    return {
      success: false,
      message: commercialRulesError,
    };
  }

  revalidatePath("/configuracoes/produtos");
  if (returnPath) {
    revalidatePath(returnPath);
    redirect(`${returnPath}?feedback=criado`);
  }

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
  const productKitsEnabled = false;
  await requireConfigSectionAccess("produtos");

  const id = String(formData.get("id") ?? "").trim();
  const redirectTo = normalizeRedirectPath(String(formData.get("redirectTo") ?? "").trim());

  if (!id) {
    redirect(buildRedirectWithFeedback(redirectTo, "erro"));
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
    productKitsEnabled
      ? adminSupabase
          .from("produto_kit_componentes")
          .select("id", { count: "exact", head: true })
          .eq("produto_componente_id", id)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);

  const totalDependencies = dependencyChecks.reduce((total, query) => total + (query.count ?? 0), 0);

  if (totalDependencies > 0) {
    redirect(buildRedirectWithFeedback(redirectTo, "vinculos"));
  }

  const { error } = await adminSupabase.from("produtos").delete().eq("id", id);

  if (error) {
    redirect(buildRedirectWithFeedback(redirectTo, "erro"));
  }

  revalidatePath("/configuracoes/produtos");
  if (redirectTo) {
    revalidatePath(redirectTo);
  }

  redirect(buildRedirectWithFeedback(redirectTo, "excluido"));
}

async function updateProductWithFallback(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  payload: Record<string, unknown>,
) {
  const result = await adminSupabase
    .from("produtos")
    .update(payload)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (result.error && isMissingPackagingColumnError(result.error.message)) {
    return updateProductWithFallback(adminSupabase, id, withoutPackagingQuantity(payload));
  }

  return result;
}

async function insertProductWithFallback(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
) {
  const result = await adminSupabase.from("produtos").insert(payload).select("id").single();

  if (result.error && isMissingPackagingColumnError(result.error.message)) {
    return insertProductWithFallback(adminSupabase, withoutPackagingQuantity(payload));
  }

  return result;
}

async function syncKitComponents(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  productId: string,
  depositanteId: string,
  tipoProduto: "SIMPLES" | "KIT",
  kitComponents: Array<{ componentProductId: string; quantity: number }>,
) {
  const { error: clearError } = await adminSupabase
    .from("produto_kit_componentes")
    .delete()
    .eq("produto_kit_id", productId);

  if (clearError) {
    return `Nao foi possivel limpar a composicao anterior do kit: ${clearError.message}`;
  }

  if (tipoProduto !== "KIT") {
    return null;
  }

  const uniqueComponentIds = [...new Set(kitComponents.map((item) => item.componentProductId))];
  const { data: componentProducts, error: componentProductsError } = await adminSupabase
    .from("produtos")
    .select("id, depositante_id, nome")
    .in("id", uniqueComponentIds);

  if (componentProductsError) {
    return `Nao foi possivel validar os componentes do kit: ${componentProductsError.message}`;
  }

  const productsById = new Map((componentProducts ?? []).map((item) => [item.id, item]));

  for (const component of kitComponents) {
    if (component.componentProductId === productId) {
      return "O kit nao pode apontar para ele mesmo como componente.";
    }

    const componentProduct = productsById.get(component.componentProductId);
    if (!componentProduct) {
      return "Um dos componentes selecionados nao foi encontrado.";
    }

    if (componentProduct.depositante_id !== depositanteId) {
      return `O componente ${componentProduct.nome} pertence a outro depositante.`;
    }
  }

  const payload = kitComponents.map((component) => ({
    depositante_id: depositanteId,
    produto_kit_id: productId,
    produto_componente_id: component.componentProductId,
    quantidade: component.quantity,
  }));

  const { error: insertError } = await adminSupabase.from("produto_kit_componentes").insert(payload);

  if (insertError) {
    return `Nao foi possivel salvar a composicao do kit: ${insertError.message}`;
  }

  return null;
}

async function syncCommercialKitRules(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  productId: string,
  depositanteId: string,
  rules: Array<{ matchText: string; operationalQuantity: number }>,
) {
  const { error: clearError } = await adminSupabase
    .from("produto_kit_comercial_regras")
    .delete()
    .eq("produto_base_id", productId);

  if (clearError) {
    return `Nao foi possivel limpar as regras comerciais do produto: ${clearError.message}`;
  }

  if (!rules.length) {
    return null;
  }

  const payload = rules.map((rule) => ({
    depositante_id: depositanteId,
    produto_base_id: productId,
    texto_gatilho: rule.matchText,
    quantidade_operacional: rule.operationalQuantity,
    ativo: true,
  }));

  const { error: insertError } = await adminSupabase
    .from("produto_kit_comercial_regras")
    .insert(payload);

  if (insertError) {
    return `Nao foi possivel salvar as regras comerciais do produto: ${insertError.message}`;
  }

  return null;
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

function parseBooleanFormValue(value: FormDataEntryValue | null, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "on", "yes", "sim"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "off", "no", "nao", "não"].includes(normalized)) {
    return false;
  }

  return fallback;
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

  if (
    message.includes("imagem_principal_url") ||
    message.includes("imagem_principal_storage_path")
  ) {
    return `Nao foi possivel ${action} o produto porque o banco online ainda nao recebeu as colunas da foto principal. Rode a migration da imagem de produto no Supabase e tente novamente.`;
  }

  return `Nao foi possivel ${action} o produto: ${message}`;
}

function normalizeRedirectPath(value: string) {
  if (!value.startsWith("/")) {
    return null;
  }

  return value;
}

function buildRedirectWithFeedback(redirectTo: string | null, feedback: string) {
  const basePath = redirectTo || "/configuracoes/produtos";
  return `${basePath}?feedback=${feedback}`;
}

function validateProdutoImageFile(file: File) {
  if (
    !allowedProdutoImageMimeTypes.includes(
      file.type as (typeof allowedProdutoImageMimeTypes)[number],
    )
  ) {
    return "Envie uma imagem PNG, JPG ou WEBP.";
  }

  if (file.size > maxProdutoImageFileSizeBytes) {
    return "A foto do produto deve ter no maximo 3 MB.";
  }

  return null;
}

async function resolveProdutoImageUpload({
  adminSupabase,
  depositanteId,
  productCode,
  currentImageUrl,
  currentImageStoragePath,
  removeImage,
  imageFile,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  depositanteId: string;
  productCode: string;
  currentImageUrl: string | null;
  currentImageStoragePath: string | null;
  removeImage: boolean;
  imageFile: FormDataEntryValue | null;
}) {
  let imageUrl = currentImageUrl;
  let imageStoragePath = currentImageStoragePath;

  if (removeImage && currentImageStoragePath) {
    await ensureProdutoImagesBucketExists(adminSupabase);
    await adminSupabase.storage.from(produtosImagesBucketName).remove([currentImageStoragePath]);
    imageUrl = null;
    imageStoragePath = null;
  }

  if (!(imageFile instanceof File) || imageFile.size <= 0) {
    return { imageUrl, imageStoragePath, error: null as string | null };
  }

  await ensureProdutoImagesBucketExists(adminSupabase);

  if (currentImageStoragePath) {
    await adminSupabase.storage.from(produtosImagesBucketName).remove([currentImageStoragePath]);
  }

  const safeFileName = sanitizeFileName(imageFile.name || "produto");
  const extension = safeFileName.split(".").pop() || "png";
  const storagePath = `${depositanteId}/${productCode.toLowerCase()}/${randomUUID()}.${extension}`;
  const fileBytes = Buffer.from(await imageFile.arrayBuffer());

  const uploadResult = await adminSupabase.storage.from(produtosImagesBucketName).upload(storagePath, fileBytes, {
    contentType: imageFile.type,
    upsert: true,
  });

  if (uploadResult.error) {
    return {
      imageUrl,
      imageStoragePath,
      error: `Nao foi possivel enviar a foto do produto: ${uploadResult.error.message}`,
    };
  }

  const { data: publicUrlData } = adminSupabase.storage
    .from(produtosImagesBucketName)
    .getPublicUrl(storagePath);

  return {
    imageUrl: publicUrlData.publicUrl,
    imageStoragePath: storagePath,
    error: null as string | null,
  };
}

async function ensureProdutoImagesBucketExists(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const { data: buckets } = await adminSupabase.storage.listBuckets();
  const alreadyExists = buckets?.some((bucket) => bucket.id === produtosImagesBucketName);

  if (alreadyExists) {
    return;
  }

  await adminSupabase.storage.createBucket(produtosImagesBucketName, {
    public: true,
    fileSizeLimit: maxProdutoImageFileSizeBytes,
    allowedMimeTypes: [...allowedProdutoImageMimeTypes],
  });
}
