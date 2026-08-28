"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isHiddenLegacyDamageEntry } from "@/lib/stock-visibility";
import {
  enderecoFormSchema,
  gerarEnderecosFormSchema,
} from "@/lib/validations/enderecos";

export type EnderecoMovimentacaoDto = {
  tipo: string;
  sinal: "+" | "-" | "";
  quantidade: number;
  quando: string;
  dataIso: string;
  ref: string;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export async function getEnderecoMovimentacoesAction(
  enderecoId: string,
  fromIso?: string | null,
  toIso?: string | null,
): Promise<EnderecoMovimentacaoDto[]> {
  await requireConfigSectionAccess("enderecos");
  const id = String(enderecoId ?? "").trim();
  if (!id) return [];

  const adminSupabase = createSupabaseAdminClient();
  let query = adminSupabase
    .from("movimentacoes_estoque")
    .select(
      "id, tipo, quantidade, created_at, observacoes, endereco_origem_id, endereco_destino_id, criado_por:usuarios(nome)",
    )
    .or(`endereco_origem_id.eq.${id},endereco_destino_id.eq.${id}`)
    .order("created_at", { ascending: false })
    .limit(500);

  if (fromIso) query = query.gte("created_at", fromIso);
  if (toIso) query = query.lte("created_at", toIso);

  const { data } = await query;

  const result: EnderecoMovimentacaoDto[] = [];
  for (const mov of data ?? []) {
    if (
      isHiddenLegacyDamageEntry({ createdAt: mov.created_at, description: mov.observacoes })
    ) {
      continue;
    }
    const operador = Array.isArray(mov.criado_por) ? mov.criado_por[0] : mov.criado_por;
    const isDestino = mov.endereco_destino_id === id;
    const isOrigem = mov.endereco_origem_id === id;
    const sinal: "+" | "-" | "" = isDestino && !isOrigem ? "+" : isOrigem && !isDestino ? "-" : "";
    const refParts = [
      mov.observacoes?.trim() || null,
      operador?.nome ? `Op. ${operador.nome}` : null,
    ].filter(Boolean);
    result.push({
      tipo: String(mov.tipo ?? ""),
      sinal,
      quantidade: Number(mov.quantidade ?? 0),
      quando: relativeTime(mov.created_at as string),
      dataIso: mov.created_at as string,
      ref: refParts.join(" · "),
    });
  }

  return result;
}

export type EnderecoActionState = {
  success: boolean;
  message: string | null;
};

export async function saveEnderecoStateAction(
  _prevState: EnderecoActionState,
  formData: FormData,
): Promise<EnderecoActionState> {
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
    capacidadePesoKg: String(formData.get("capacidadePesoKg") ?? "").trim(),
    volumeModo: String(formData.get("volumeModo") ?? "").trim(),
    alturaCm: String(formData.get("alturaCm") ?? "").trim(),
    larguraCm: String(formData.get("larguraCm") ?? "").trim(),
    comprimentoCm: String(formData.get("comprimentoCm") ?? "").trim(),
    unidadePadrao: String(formData.get("unidadePadrao") ?? "").trim(),
    ativo: formData.get("ativo") === "on",
  });

  if (!parsed.success) {
    return { success: false, message: "Revise os campos e tente novamente." };
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
    capacidade_peso_kg: parsed.data.capacidadePesoKg
      ? Number(parsed.data.capacidadePesoKg.replace(",", "."))
      : null,
    volume_modo: parsed.data.volumeModo || null,
    altura_cm: parsed.data.alturaCm ? Number(parsed.data.alturaCm.replace(",", ".")) : null,
    largura_cm: parsed.data.larguraCm ? Number(parsed.data.larguraCm.replace(",", ".")) : null,
    comprimento_cm: parsed.data.comprimentoCm
      ? Number(parsed.data.comprimentoCm.replace(",", "."))
      : null,
    unidade_padrao: parsed.data.unidadePadrao || null,
    ativo: parsed.data.ativo,
  };

  if (parsed.data.id) {
    const { error } = await adminSupabase.from("enderecos").update(payload).eq("id", parsed.data.id);
    if (error) {
      return { success: false, message: `Não foi possível atualizar o endereço: ${error.message}` };
    }
    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/enderecos");
    return { success: true, message: "Endereço atualizado com sucesso." };
  }

  const { error } = await adminSupabase.from("enderecos").insert(payload);
  if (error) {
    return { success: false, message: `Não foi possível criar o endereço: ${error.message}` };
  }
  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/enderecos");
  return { success: true, message: "Endereço criado com sucesso." };
}

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
    capacidadePesoKg: String(formData.get("capacidadePesoKg") ?? "").trim(),
    volumeModo: String(formData.get("volumeModo") ?? "").trim(),
    alturaCm: String(formData.get("alturaCm") ?? "").trim(),
    larguraCm: String(formData.get("larguraCm") ?? "").trim(),
    comprimentoCm: String(formData.get("comprimentoCm") ?? "").trim(),
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
    capacidade_peso_kg: parsed.data.capacidadePesoKg
      ? Number(parsed.data.capacidadePesoKg.replace(",", "."))
      : null,
    volume_modo: parsed.data.volumeModo || null,
    altura_cm: parsed.data.alturaCm ? Number(parsed.data.alturaCm.replace(",", ".")) : null,
    largura_cm: parsed.data.larguraCm ? Number(parsed.data.larguraCm.replace(",", ".")) : null,
    comprimento_cm: parsed.data.comprimentoCm
      ? Number(parsed.data.comprimentoCm.replace(",", "."))
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
  const isSpa = String(formData.get("isSpa") ?? "") === "true";

  if (!id) {
    if (isSpa) return { success: false, message: "Endereço não informado." };
    redirect("/configuracoes/enderecos?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { count: estoqueCount } = await adminSupabase
    .from("estoque")
    .select("id", { count: "exact", head: true })
    .eq("endereco_id", id);

  if ((estoqueCount ?? 0) > 0) {
    if (isSpa) {
      return {
        success: false,
        message:
          "Não foi possível excluir: este endereço possui estoque vinculado. Nesse caso, use bloquear.",
      };
    }
    redirect("/configuracoes/enderecos?feedback=vinculos");
  }

  const { error } = await adminSupabase.from("enderecos").delete().eq("id", id);

  if (error) {
    if (isSpa) return { success: false, message: "Não foi possível excluir o endereço." };
    redirect("/configuracoes/enderecos?feedback=erro");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/enderecos");
  if (isSpa) return { success: true, message: "Endereço excluído." };
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
    capacidadePesoKg: String(formData.get("capacidadePesoKg") ?? "").trim(),
    volumeModo: String(formData.get("volumeModo") ?? "").trim(),
    alturaCm: String(formData.get("alturaCm") ?? "").trim(),
    larguraCm: String(formData.get("larguraCm") ?? "").trim(),
    comprimentoCm: String(formData.get("comprimentoCm") ?? "").trim(),
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
  const areaCode = getÁreaCode(parsed.data.area);

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
            capacidade_peso_kg: parsed.data.capacidadePesoKg
              ? Number(parsed.data.capacidadePesoKg.replace(",", "."))
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

function getÁreaCode(area: string) {
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
