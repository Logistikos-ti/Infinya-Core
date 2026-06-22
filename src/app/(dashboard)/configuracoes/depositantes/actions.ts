"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import {
  buildStoredDepositanteConfiguracoes,
  normalizeEmailContacts,
  normalizePhoneContacts,
  parseDepositanteConfiguracoes,
} from "@/lib/depositantes";
import {
  allowedDepositanteLogoMimeTypes,
  depositantesLogosBucketName,
  maxDepositanteLogoFileSizeBytes,
  sanitizeFileName,
} from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { depositanteFormSchema } from "@/lib/validations/depositantes";

export type DepositanteActionState = {
  success: boolean;
  message: string | null;
  errors?: Partial<
    Record<
      | "codigo"
      | "nome"
      | "razaoSocial"
      | "cnpj"
      | "enderecoFiscalCep"
      | "enderecoFiscalLogradouro"
      | "enderecoFiscalNumero"
      | "enderecoFiscalComplemento"
      | "enderecoFiscalBairro"
      | "enderecoFiscalCidade"
      | "enderecoFiscalUf"
      | "contatosTelefone"
      | "contatosEmail"
      | "observacoes"
      | "diasMinimosValidade"
      | "prefixoRecebimento"
      | "logoFile",
      string
    >
  >;
};

export async function saveDepositanteAction(
  _prevState: DepositanteActionState,
  formData: FormData,
): Promise<DepositanteActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const parsed = depositanteFormSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    codigo: String(formData.get("codigo") ?? "").trim().toUpperCase(),
    nome: String(formData.get("nome") ?? ""),
    razaoSocial: String(formData.get("razaoSocial") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
    enderecoFiscalCep: String(formData.get("enderecoFiscalCep") ?? ""),
    enderecoFiscalLogradouro: String(formData.get("enderecoFiscalLogradouro") ?? ""),
    enderecoFiscalNumero: String(formData.get("enderecoFiscalNumero") ?? ""),
    enderecoFiscalComplemento: String(formData.get("enderecoFiscalComplemento") ?? ""),
    enderecoFiscalBairro: String(formData.get("enderecoFiscalBairro") ?? ""),
    enderecoFiscalCidade: String(formData.get("enderecoFiscalCidade") ?? ""),
    enderecoFiscalUf: String(formData.get("enderecoFiscalUf") ?? "").toUpperCase(),
    observacoes: String(formData.get("observacoes") ?? ""),
    metodoRetiradaPadrao: String(formData.get("metodoRetiradaPadrao") ?? "FEFO"),
    exigeLotePadrao: formData.get("exigeLotePadrao") === "on",
    exigeValidadePadrao: formData.get("exigeValidadePadrao") === "on",
    permiteFracionamento: formData.get("permiteFracionamento") === "on",
    diasMinimosValidade: Number(formData.get("diasMinimosValidade") ?? 0),
    prefixoRecebimento: String(formData.get("prefixoRecebimento") ?? ""),
    ativo: formData.get("ativo") === "on",
  });

  const telefonesContato = normalizePhoneContacts(
    formData.getAll("contatoTelefone").map((telefone, index) => ({
      nome: String(formData.getAll("contatoTelefoneNome")[index] ?? ""),
      telefone: String(telefone ?? ""),
    })),
  );

  const emailsContato = normalizeEmailContacts(
    formData.getAll("contatoEmail").map((email) => ({
      email: String(email ?? ""),
    })),
  );

  const hasInvalidTelefoneContact = formData.getAll("contatoTelefone").some((telefone, index) => {
    const telefoneValue = String(telefone ?? "").trim();
    const nomeValue = String(formData.getAll("contatoTelefoneNome")[index] ?? "").trim();
    return (telefoneValue && !nomeValue) || (!telefoneValue && nomeValue);
  });

  if (!parsed.success || hasInvalidTelefoneContact) {
    const flattened = parsed.success ? {} : parsed.error.flatten().fieldErrors;

    return {
      success: false,
      message: "Revise os campos destacados e tente novamente.",
      errors: {
        codigo: "codigo" in flattened ? flattened.codigo?.[0] ?? "" : "",
        nome: "nome" in flattened ? flattened.nome?.[0] ?? "" : "",
        razaoSocial: "razaoSocial" in flattened ? flattened.razaoSocial?.[0] ?? "" : "",
        cnpj: "cnpj" in flattened ? flattened.cnpj?.[0] ?? "" : "",
        enderecoFiscalCep:
          "enderecoFiscalCep" in flattened ? flattened.enderecoFiscalCep?.[0] ?? "" : "",
        enderecoFiscalLogradouro:
          "enderecoFiscalLogradouro" in flattened
            ? flattened.enderecoFiscalLogradouro?.[0] ?? ""
            : "",
        enderecoFiscalNumero:
          "enderecoFiscalNumero" in flattened ? flattened.enderecoFiscalNumero?.[0] ?? "" : "",
        enderecoFiscalComplemento:
          "enderecoFiscalComplemento" in flattened
            ? flattened.enderecoFiscalComplemento?.[0] ?? ""
            : "",
        enderecoFiscalBairro:
          "enderecoFiscalBairro" in flattened ? flattened.enderecoFiscalBairro?.[0] ?? "" : "",
        enderecoFiscalCidade:
          "enderecoFiscalCidade" in flattened ? flattened.enderecoFiscalCidade?.[0] ?? "" : "",
        enderecoFiscalUf:
          "enderecoFiscalUf" in flattened ? flattened.enderecoFiscalUf?.[0] ?? "" : "",
        observacoes: "observacoes" in flattened ? flattened.observacoes?.[0] ?? "" : "",
        diasMinimosValidade:
          "diasMinimosValidade" in flattened
            ? flattened.diasMinimosValidade?.[0] ?? ""
            : "",
        prefixoRecebimento:
          "prefixoRecebimento" in flattened ? flattened.prefixoRecebimento?.[0] ?? "" : "",
        contatosTelefone: hasInvalidTelefoneContact
          ? "Informe o nome do responsável e o telefone em cada contato telefônico."
          : "",
      },
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const currentDepositante = parsed.data.id
    ? await adminSupabase
        .from("depositantes")
        .select("configuracoes, observacoes")
        .eq("id", parsed.data.id)
        .maybeSingle()
    : null;
  const currentLogoUrl = String(formData.get("currentLogoUrl") ?? "").trim() || null;
  const currentLogoStoragePath =
    String(formData.get("currentLogoStoragePath") ?? "").trim() || null;
  const removeLogo = formData.get("removeLogo") === "on";
  const logoFile = formData.get("logoFile");

  let nextLogoUrl = currentLogoUrl;
  let nextLogoStoragePath = currentLogoStoragePath;

  if (removeLogo && currentLogoStoragePath) {
    await ensureDepositanteLogoBucketExists(adminSupabase);
    await adminSupabase.storage.from(depositantesLogosBucketName).remove([currentLogoStoragePath]);
    nextLogoUrl = null;
    nextLogoStoragePath = null;
  }

  if (logoFile instanceof File && logoFile.size > 0) {
    const uploadValidationError = validateLogoFile(logoFile);

    if (uploadValidationError) {
      return {
        success: false,
        message: "Não foi possível salvar o depositante.",
        errors: {
          logoFile: uploadValidationError,
        },
      };
    }

    await ensureDepositanteLogoBucketExists(adminSupabase);

    if (currentLogoStoragePath) {
      await adminSupabase
        .storage
        .from(depositantesLogosBucketName)
        .remove([currentLogoStoragePath]);
    }

    const safeFileName = sanitizeFileName(logoFile.name || "logo");
    const extension = safeFileName.includes(".") ? safeFileName.split(".").pop() : "png";
    const storagePath = `${parsed.data.codigo.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
    const fileBytes = Buffer.from(await logoFile.arrayBuffer());

    const uploadResult = await adminSupabase.storage
      .from(depositantesLogosBucketName)
      .upload(storagePath, fileBytes, {
        contentType: logoFile.type,
        upsert: false,
      });

    if (uploadResult.error) {
      return {
        success: false,
        message: `Não foi possível enviar a logo: ${uploadResult.error.message}`,
      };
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from(depositantesLogosBucketName)
      .getPublicUrl(storagePath);

    nextLogoUrl = publicUrlData.publicUrl;
    nextLogoStoragePath = storagePath;
  }

  const currentConfiguracoesRaw =
    currentDepositante?.data?.configuracoes
      ? JSON.stringify(currentDepositante.data.configuracoes)
      : currentDepositante?.data?.observacoes ?? null;
  const currentConfiguracoes = parseDepositanteConfiguracoes(currentConfiguracoesRaw);

  const configuracoes = buildStoredDepositanteConfiguracoes(currentConfiguracoesRaw, {
    razaoSocial: parsed.data.razaoSocial,
    observacoes: parsed.data.observacoes || "",
    metodoRetiradaPadrao: parsed.data.metodoRetiradaPadrao,
    exigeLotePadrao: parsed.data.exigeLotePadrao,
    exigeValidadePadrao: parsed.data.exigeValidadePadrao,
    permiteFracionamento: parsed.data.permiteFracionamento,
    diasMinimosValidade: parsed.data.diasMinimosValidade,
    prefixoRecebimento: parsed.data.prefixoRecebimento || "",
    logoStoragePath: nextLogoStoragePath,
    enderecoFiscal: {
      cep: parsed.data.enderecoFiscalCep || "",
      logradouro: parsed.data.enderecoFiscalLogradouro || "",
      numero: parsed.data.enderecoFiscalNumero || "",
      complemento: parsed.data.enderecoFiscalComplemento || "",
      bairro: parsed.data.enderecoFiscalBairro || "",
      cidade: parsed.data.enderecoFiscalCidade || "",
      uf: parsed.data.enderecoFiscalUf || "",
    },
    emailsContato,
    telefonesContato,
    bling: currentConfiguracoes.bling,
    mercadoLivre: currentConfiguracoes.mercadoLivre,
  });

  const payload = {
    codigo: parsed.data.codigo,
    nome: parsed.data.nome,
    cnpj: normalizeCnpj(parsed.data.cnpj),
    logo_url: nextLogoUrl,
    observacoes: parsed.data.observacoes || null,
    configuracoes,
    ativo: parsed.data.ativo,
  };

  if (parsed.data.id) {
    const { error } = await adminSupabase
      .from("depositantes")
      .update(payload)
      .eq("id", parsed.data.id);

    if (error) {
      return {
        success: false,
        message: `Não foi possível atualizar o depositante: ${error.message}`,
      };
    }

    revalidatePath("/configuracoes/depositantes");
    revalidatePath(`/configuracoes/depositantes/${parsed.data.id}/editar`);
    redirect("/configuracoes/depositantes?feedback=salvo");
  }

  const { error } = await adminSupabase.from("depositantes").insert(payload);

  if (error) {
    return {
      success: false,
      message: `Não foi possível criar o depositante: ${error.message}`,
    };
  }

  revalidatePath("/configuracoes/depositantes");
  redirect("/configuracoes/depositantes?feedback=criado");
}

export async function toggleDepositanteStatusAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("nextActive") ?? "").trim() === "true";

  if (!id) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();

  await adminSupabase.from("depositantes").update({ ativo: nextActive }).eq("id", id);

  revalidatePath("/configuracoes/depositantes");
}

export async function deleteDepositanteAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/configuracoes/depositantes?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data: depositante } = await adminSupabase
    .from("depositantes")
    .select("logo_url, observacoes, configuracoes")
    .eq("id", id)
    .maybeSingle();

  const dependencyChecks = await Promise.all([
    adminSupabase.from("usuarios").select("id", { count: "exact", head: true }).eq("depositante_id", id),
    adminSupabase.from("produtos").select("id", { count: "exact", head: true }).eq("depositante_id", id),
    adminSupabase
      .from("pedidos_recebimento")
      .select("id", { count: "exact", head: true })
      .eq("depositante_id", id),
    adminSupabase.from("estoque").select("id", { count: "exact", head: true }).eq("depositante_id", id),
  ]);

  const totalDependencies = dependencyChecks.reduce((total, query) => total + (query.count ?? 0), 0);

  if (totalDependencies > 0) {
    redirect("/configuracoes/depositantes?feedback=vinculos");
  }

  const configuracoes = parseDepositanteConfiguracoes(
    depositante?.configuracoes
      ? JSON.stringify(depositante.configuracoes)
      : depositante?.observacoes ?? null,
  );

  if (configuracoes.logoStoragePath) {
    await ensureDepositanteLogoBucketExists(adminSupabase);
    await adminSupabase.storage.from(depositantesLogosBucketName).remove([configuracoes.logoStoragePath]);
  }

  const { error } = await adminSupabase.from("depositantes").delete().eq("id", id);

  if (error) {
    redirect("/configuracoes/depositantes?feedback=erro");
  }

  revalidatePath("/configuracoes/depositantes");
  redirect("/configuracoes/depositantes?feedback=excluido");
}

async function ensureDepositanteLogoBucketExists(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const { data: buckets } = await adminSupabase.storage.listBuckets();
  const alreadyExists = buckets?.some((bucket) => bucket.id === depositantesLogosBucketName);

  if (alreadyExists) {
    return;
  }

  await adminSupabase.storage.createBucket(depositantesLogosBucketName, {
    public: true,
    fileSizeLimit: maxDepositanteLogoFileSizeBytes,
    allowedMimeTypes: [...allowedDepositanteLogoMimeTypes],
  });
}

function validateLogoFile(file: File) {
  if (
    !allowedDepositanteLogoMimeTypes.includes(
      file.type as (typeof allowedDepositanteLogoMimeTypes)[number],
    )
  ) {
    return "Envie uma imagem PNG, JPG ou WEBP.";
  }

  if (file.size > maxDepositanteLogoFileSizeBytes) {
    return "A logo deve ter no máximo 2 MB.";
  }

  return null;
}

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "");
}
