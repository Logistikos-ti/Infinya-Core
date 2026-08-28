import { requireConfigSectionAccess, requireRoleAccess } from "@/lib/auth";
import {
  isTransportadorasSchemaMissing,
  normalizeTransportadoraTipo,
  type TransportadoraListItem,
} from "@/lib/transportadoras";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TransportadorasView } from "@/components/configuracoes/transportadoras-view";

function normalizeNome(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export default async function ConfiguracoesTransportadorasPage() {
  await requireRoleAccess(["ADMIN", "TI"]);
  await requireConfigSectionAccess("transportadoras");
  const supabase = await createSupabaseServerClient();

  const fullColumns =
    "id, nome, razao_social, cnpj, email, telefone, cidade, uf, tipo, modalidades, observacoes, ativo, created_at";
  const baseColumns =
    "id, nome, razao_social, cnpj, email, telefone, modalidades, observacoes, ativo, created_at";

  const first = await supabase.from("transportadoras").select(fullColumns).order("nome");

  // Se as colunas cidade/uf/tipo ainda não existem (migração não rodada), o
  // erro é de coluna ausente (42703), não de tabela ausente — refaz a consulta
  // com as colunas base para que a tela funcione mesmo antes da migração.
  const fallback =
    first.error?.code === "42703"
      ? await supabase.from("transportadoras").select(baseColumns).order("nome")
      : null;

  const data = (fallback?.data ?? first.data) as Array<Record<string, unknown>> | null;
  const error = fallback?.error ?? first.error;

  // Só é "schema ausente" quando a própria tabela não existe (42P01).
  const schemaMissing =
    error?.code === "42P01" || (error ? isTransportadorasSchemaMissing(error) : false);

  // Métricas derivadas de romaneios_carga: contagem do mês e placas distintas
  // (proxy para "veículos", que não tem tabela própria). Tolerante a ausência
  // da tabela / colunas — se falhar, as métricas ficam zeradas.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const romaneiosMesPorId = new Map<string, number>();
  const romaneiosMesPorNome = new Map<string, number>();
  const placasPorId = new Map<string, Set<string>>();
  const placasPorNome = new Map<string, Set<string>>();
  let romaneiosNoMesTotal = 0;

  if (!schemaMissing) {
    try {
      const { data: romaneios } = await supabase
        .from("romaneios_carga")
        .select("transportadora_id, transportadora_nome, veiculo_placa, criado_em");

      for (const r of romaneios ?? []) {
        const id = r.transportadora_id ? String(r.transportadora_id) : null;
        const nome = normalizeNome(r.transportadora_nome);
        const placa = String(r.veiculo_placa ?? "").trim().toUpperCase();
        const noMes = r.criado_em ? String(r.criado_em) >= monthStart : false;

        if (noMes) {
          romaneiosNoMesTotal += 1;
          if (id) romaneiosMesPorId.set(id, (romaneiosMesPorId.get(id) ?? 0) + 1);
          if (nome) romaneiosMesPorNome.set(nome, (romaneiosMesPorNome.get(nome) ?? 0) + 1);
        }

        if (placa) {
          if (id) {
            const set = placasPorId.get(id) ?? new Set<string>();
            set.add(placa);
            placasPorId.set(id, set);
          }
          if (nome) {
            const set = placasPorNome.get(nome) ?? new Set<string>();
            set.add(placa);
            placasPorNome.set(nome, set);
          }
        }
      }
    } catch {
      // romaneios_carga indisponível — segue com métricas zeradas.
    }
  }

  const transportadoras: TransportadoraListItem[] = schemaMissing
    ? []
    : ((data ?? []) as Array<Record<string, unknown>>).map((item) => {
        const id = String(item.id);
        const nomeKey = normalizeNome(item.nome);
        const razaoKey = normalizeNome(item.razao_social);

        const romaneiosMes =
          romaneiosMesPorId.get(id) ??
          romaneiosMesPorNome.get(nomeKey) ??
          romaneiosMesPorNome.get(razaoKey) ??
          0;

        const placas =
          placasPorId.get(id) ?? placasPorNome.get(nomeKey) ?? placasPorNome.get(razaoKey) ?? null;

        return {
          id,
          nome: String(item.nome ?? ""),
          razaoSocial: String(item.razao_social ?? item.nome ?? ""),
          cnpj: String(item.cnpj ?? ""),
          email: typeof item.email === "string" ? item.email : null,
          telefone: typeof item.telefone === "string" ? item.telefone : null,
          cidade: typeof item.cidade === "string" && item.cidade ? item.cidade : null,
          uf: typeof item.uf === "string" && item.uf ? item.uf : null,
          tipo: normalizeTransportadoraTipo(String(item.tipo ?? "")),
          modalidades: [],
          observacoes: typeof item.observacoes === "string" ? item.observacoes : null,
          ativo: Boolean(item.ativo),
          createdAt: String(item.created_at ?? ""),
          romaneiosMes,
          veiculos: placas ? placas.size : 0,
        };
      });

  const ativas = transportadoras.filter((t) => t.ativo).length;

  return (
    <TransportadorasView
      rows={transportadoras}
      schemaMissing={schemaMissing}
      kpis={{
        total: transportadoras.length,
        ativas,
        romaneiosNoMes: romaneiosNoMesTotal,
      }}
    />
  );
}
