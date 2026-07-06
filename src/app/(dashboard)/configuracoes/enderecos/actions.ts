"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  enderecoFormSchema,
  gerarEnderecosFormSchema,
} from "@/lib/validations/enderecos";

export async function saveEnderecoAction(formData: FormData) {
  await requireConfigSectionAccess("enderecos");

  const parsed = enderecoFormSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    codigo: String(formData.get("codigo") ?? "").trim().toUpperCase(),
    descricao: String(formData.get("descricao") ?? "").trim(),
    area: String(formData.get("area") ?? "PICKING").trim(),
    rua: String(formData.get("rua") ?? "").trim().toUpperCase(),
    modulo: String(formData.get("modulo") ?? "").trim().toUpperCase(),
    nivel: String(formData.get("nivel") ?? "").trim().toUpperCase(),
    posicao: String(formData.get("posicao") ?? "").trim().toUpperCase(),
    capacidadeMaxima: String(formData.get("capacidadeMaxima") ?? "").trim(),
    unidadePadrao: String(formData.get("unidadePadrao") ?? "").trim(),
    ativo: formData.get("ativo") === "on",
  });

  if (!parsed.success) {
    redirect("/configuracoes/enderecos?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const payload = {
    codigo: parsed.data.codigo,
    descricao: parsed.data.descricao || null,
    area: parsed.data.area,
    rua: parsed.data.rua || null,
    modulo: parsed.data.modulo || null,
    nivel: parsed.data.nivel || null,
    posicao: parsed.data.posicao || null,
    capacidade_maxima: parsed.data.capacidadeMaxima
      ? Number(parsed.data.capacidadeMaxima.replace(",", "."))
      : null,
    unidade_padrao: parsed.data.unidadePadrao || null,
    ativo: parsed.data.ativo,
  };

  if (parsed.data.id) {
    const { error } = await adminSupabase.from("enderecos").update(payload).eq("id", parsed.data.id);

    if (error) {
      redirect("/configuracoes/enderecos?feedback=erro");
    }

    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/enderecos");
    redirect("/configuracoes/enderecos?feedback=salvo");
  }

  const { error } = await adminSupabase.from("enderecos").insert(payload);

  if (error) {
    redirect("/configuracoes/enderecos?feedback=erro");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/enderecos");
  redirect("/configuracoes/enderecos?feedback=criado");
}

export async function toggleEnderecoStatusAction(formData: FormData) {
  await requireConfigSectionAccess("enderecos");

  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("nextActive") ?? "").trim() === "true";

  if (!id) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.from("enderecos").update({ ativo: nextActive }).eq("id", id);

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/enderecos");
}

export async function deleteEnderecoAction(formData: FormData) {
  await requireConfigSectionAccess("enderecos");

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/configuracoes/enderecos?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { count: estoqueCount } = await adminSupabase
    .from("estoque")
    .select("id", { count: "exact", head: true })
    .eq("endereco_id", id);

  if ((estoqueCount ?? 0) > 0) {
    redirect("/configuracoes/enderecos?feedback=vinculos");
  }

  const { error } = await adminSupabase.from("enderecos").delete().eq("id", id);

  if (error) {
    redirect("/configuracoes/enderecos?feedback=erro");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/enderecos");
  redirect("/configuracoes/enderecos?feedback=excluido");
}

export async function generateEnderecosAction(formData: FormData) {
  await requireConfigSectionAccess("enderecos");

  const parsed = gerarEnderecosFormSchema.safeParse({
    area: String(formData.get("area") ?? "PICKING").trim(),
    descricaoBase: String(formData.get("descricaoBase") ?? "").trim(),
    corredorPrefixo: String(formData.get("corredorPrefixo") ?? "R").trim().toUpperCase(),
    corredorInicio: Number(formData.get("corredorInicio") ?? 1),
    corredorFim: Number(formData.get("corredorFim") ?? 1),
    moduloPrefixo: String(formData.get("moduloPrefixo") ?? "M").trim().toUpperCase(),
    moduloInicio: Number(formData.get("moduloInicio") ?? 1),
    moduloFim: Number(formData.get("moduloFim") ?? 1),
    nivelPrefixo: String(formData.get("nivelPrefixo") ?? "N").trim().toUpperCase(),
    nivelInicio: Number(formData.get("nivelInicio") ?? 1),
    nivelFim: Number(formData.get("nivelFim") ?? 1),
    posicaoPrefixo: String(formData.get("posicaoPrefixo") ?? "P").trim().toUpperCase(),
    posicaoInicio: Number(formData.get("posicaoInicio") ?? 1),
    posicaoFim: Number(formData.get("posicaoFim") ?? 1),
    capacidadeMaxima: String(formData.get("capacidadeMaxima") ?? "").trim(),
    unidadePadrao: String(formData.get("unidadePadrao") ?? "").trim(),
    ativo: formData.get("ativo") === "on",
  });

  if (!parsed.success) {
    redirect("/configuracoes/enderecos?feedback=erro-geracao");
  }

  if (
    parsed.data.corredorInicio > parsed.data.corredorFim ||
    parsed.data.moduloInicio > parsed.data.moduloFim ||
    parsed.data.nivelInicio > parsed.data.nivelFim ||
    parsed.data.posicaoInicio > parsed.data.posicaoFim
  ) {
    redirect("/configuracoes/enderecos?feedback=erro-geracao");
  }

  const corredorWidth = Math.max(2, String(parsed.data.corredorFim).length);
  const moduloWidth = Math.max(2, String(parsed.data.moduloFim).length);
  const nivelWidth = Math.max(2, String(parsed.data.nivelFim).length);
  const posicaoWidth = Math.max(2, String(parsed.data.posicaoFim).length);
  const areaCode = getAreaCode(parsed.data.area);

  const payload: Array<Record<string, string | number | boolean | null>> = [];

  for (let corredor = parsed.data.corredorInicio; corredor <= parsed.data.corredorFim; corredor += 1) {
    for (let modulo = parsed.data.moduloInicio; modulo <= parsed.data.moduloFim; modulo += 1) {
      for (let nivel = parsed.data.nivelInicio; nivel <= parsed.data.nivelFim; nivel += 1) {
        for (
          let posicao = parsed.data.posicaoInicio;
          posicao <= parsed.data.posicaoFim;
          posicao += 1
        ) {
          const rua = `${parsed.data.corredorPrefixo}${String(corredor).padStart(corredorWidth, "0")}`;
          const moduloLabel = `${parsed.data.moduloPrefixo}${String(modulo).padStart(moduloWidth, "0")}`;
          const nivelLabel = `${parsed.data.nivelPrefixo}${String(nivel).padStart(nivelWidth, "0")}`;
          const posicaoLabel = `${parsed.data.posicaoPrefixo}${String(posicao).padStart(posicaoWidth, "0")}`;
          const codigo = `${areaCode}-${rua}-${moduloLabel}-${nivelLabel}-${posicaoLabel}`;

          payload.push({
            codigo,
            descricao: parsed.data.descricaoBase
              ? `${parsed.data.descricaoBase} ${rua} ${moduloLabel} ${nivelLabel} ${posicaoLabel}`
              : null,
            area: parsed.data.area,
            rua,
            modulo: moduloLabel,
            nivel: nivelLabel,
            posicao: posicaoLabel,
            capacidade_maxima: parsed.data.capacidadeMaxima
              ? Number(parsed.data.capacidadeMaxima.replace(",", "."))
              : null,
            unidade_padrao: parsed.data.unidadePadrao || null,
            ativo: parsed.data.ativo,
          });
        }
      }
    }
  }

  if (payload.length === 0 || payload.length > 5000) {
    redirect("/configuracoes/enderecos?feedback=erro-geracao");
  }

  const adminSupabase = createSupabaseAdminClient();
  const chunkSize = 200;

  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    const { error } = await adminSupabase
      .from("enderecos")
      .upsert(chunk, { onConflict: "codigo" });

    if (error) {
      redirect("/configuracoes/enderecos?feedback=erro-geracao");
    }
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/enderecos");
  redirect(`/configuracoes/enderecos?feedback=gerado&total=${payload.length}`);
}

function getAreaCode(area: string) {
  switch (area) {
    case "RECEBIMENTO":
      return "REC";
    case "PULMAO":
      return "PUL";
    case "PICKING":
      return "PICK";
    case "BLOQUEADO":
      return "BLQ";
    case "EXPEDICAO":
      return "EXP";
    default:
      return "END";
  }
}
