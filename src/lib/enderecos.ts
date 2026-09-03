import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AddressOccupancySummary = {
  id: string;
  codigo: string;
  ocupacao: number | null;
  produtoPrincipal: string | null;
};

// Ocupação aproximada: para cada endereço, a razão entre peso/volume ocupado
// e a capacidade configurada (mesma lógica de configuracoes/enderecos/page.tsx,
// extraída aqui pra ser reutilizável fora daquela tela).
function calcularOcupacao(
  peso: number,
  volume: number,
  capacidadePesoKg: number,
  capacidadeVolume: number,
): number | null {
  const razoes: number[] = [];
  if (capacidadePesoKg > 0) razoes.push(Math.min(1, peso / capacidadePesoKg));
  if (capacidadeVolume > 0) razoes.push(Math.min(1, volume / capacidadeVolume));
  if (!razoes.length) return null;
  const media = razoes.reduce((total, r) => total + r, 0) / razoes.length;
  return Math.min(100, Math.round(media * 100));
}

function volumeEndereco(
  modo: string | null,
  altura: number,
  largura: number,
  comprimento: number,
  capacidadeMaxima: number,
): number {
  const volumeBase = altura * largura * comprimento;
  if (volumeBase <= 0) return 0;
  if (modo === "PALLET") return volumeBase * Math.max(0, capacidadeMaxima);
  if (modo === "DIMENSOES") return volumeBase;
  return 0;
}

export async function listAddressOccupancyFromDb(): Promise<{
  items: AddressOccupancySummary[];
  ocupacaoMedia: number;
}> {
  const supabase = createSupabaseAdminClient();

  const [{ data: enderecos }, { data: saldos }] = await Promise.all([
    supabase
      .from("enderecos")
      .select(
        "id, codigo, area, capacidade_maxima, capacidade_peso_kg, volume_modo, altura_cm, largura_cm, comprimento_cm, ativo",
      )
      .order("codigo"),
    supabase
      .from("estoque")
      .select(
        "endereco_id, quantidade, quantidade_reservada, produto:produtos(sku, nome, peso_kg, altura_cm, largura_cm, comprimento_cm)",
      ),
  ]);

  const pesoPorEndereco = new Map<string, number>();
  const volumePorEndereco = new Map<string, number>();
  const principalPorEndereco = new Map<string, { nome: string; quantidade: number }>();

  for (const saldo of saldos ?? []) {
    const disponivel = Math.max(
      0,
      Number(saldo.quantidade ?? 0) - Number(saldo.quantidade_reservada ?? 0),
    );
    if (disponivel <= 0) continue;
    const produto = Array.isArray(saldo.produto) ? saldo.produto[0] : saldo.produto;
    const volumeUnitario =
      Number(produto?.altura_cm ?? 0) * Number(produto?.largura_cm ?? 0) * Number(produto?.comprimento_cm ?? 0);
    if (volumeUnitario > 0) {
      volumePorEndereco.set(
        saldo.endereco_id,
        (volumePorEndereco.get(saldo.endereco_id) ?? 0) + disponivel * volumeUnitario,
      );
    }
    const pesoUnitario = Number(produto?.peso_kg ?? 0);
    if (pesoUnitario > 0) {
      pesoPorEndereco.set(
        saldo.endereco_id,
        (pesoPorEndereco.get(saldo.endereco_id) ?? 0) + disponivel * pesoUnitario,
      );
    }
    if (produto?.nome) {
      const atual = principalPorEndereco.get(saldo.endereco_id);
      if (!atual || disponivel > atual.quantidade) {
        principalPorEndereco.set(saldo.endereco_id, { nome: produto.nome, quantidade: disponivel });
      }
    }
  }

  const items = (enderecos ?? [])
    .filter((e) => e.ativo && e.area !== "BLOQUEADO")
    .map((e) => {
      const peso = pesoPorEndereco.get(e.id) ?? 0;
      const volume = volumePorEndereco.get(e.id) ?? 0;
      const cap = Number(e.capacidade_maxima ?? 0);
      const capPeso = Number(e.capacidade_peso_kg ?? 0);
      const capVolume = volumeEndereco(
        (e.volume_modo as string | null) ?? null,
        Number(e.altura_cm ?? 0),
        Number(e.largura_cm ?? 0),
        Number(e.comprimento_cm ?? 0),
        cap,
      );
      return {
        id: e.id as string,
        codigo: e.codigo as string,
        ocupacao: calcularOcupacao(peso, volume, capPeso, capVolume),
        produtoPrincipal: principalPorEndereco.get(e.id)?.nome ?? null,
      };
    });

  const comOcupacao = items.filter((r) => r.ocupacao != null);
  const ocupacaoMedia = comOcupacao.length
    ? Math.round(comOcupacao.reduce((total, r) => total + (r.ocupacao ?? 0), 0) / comOcupacao.length)
    : 0;

  return { items, ocupacaoMedia };
}
