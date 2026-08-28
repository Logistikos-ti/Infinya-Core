import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EnderecosView } from "@/components/configuracoes/enderecos-view";

// Ocupação aproximada: para cada endereço, o sistema calcula a razão de cada
// dimensão configurada (quantidade vs. capacidade_maxima, e peso total vs.
// capacidade_peso_kg) e retorna a MÉDIA das razões disponíveis. É uma média
// operacional, não um número exato.
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

// Volume da posição (cm³) a partir do modo configurado.
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

export default async function ConfiguracoesEnderecosPage() {
  await requireConfigSectionAccess("enderecos");
  const supabase = await createSupabaseServerClient();

  const [{ data: enderecos }, { data: saldos }] = await Promise.all([
    supabase
      .from("enderecos")
      .select(
        "id, codigo, descricao, area, rua, modulo, nivel, posicao, capacidade_maxima, capacidade_peso_kg, volume_modo, altura_cm, largura_cm, comprimento_cm, unidade_padrao, ativo",
      )
      .order("codigo"),
    supabase
      .from("estoque")
      .select(
        "endereco_id, quantidade, quantidade_reservada, depositante:depositantes(nome), produto:produtos(sku, nome, peso_kg, unidade_estocagem, imagem_principal_url, altura_cm, largura_cm, comprimento_cm)",
      ),
  ]);

  const unidadeLabel = (unidade: string | null | undefined) => {
    switch (unidade) {
      case "CAIXA":
        return "cx";
      case "PALLET":
        return "plt";
      case "UNIDADE":
        return "un";
      default:
        return "un";
    }
  };

  const saldoPorEndereco = new Map<string, number>();
  const pesoPorEndereco = new Map<string, number>();
  const volumePorEndereco = new Map<string, number>();
  const skusPorEndereco = new Map<string, Set<string>>();
  const produtosPorEndereco = new Map<
    string,
    Array<{
      nome: string;
      sku: string;
      quantidade: number;
      unidade: string;
      imagemUrl: string | null;
      depositante: string;
    }>
  >();
  const unidadesPorEndereco = new Map<string, Set<string>>();
  for (const saldo of saldos ?? []) {
    const disponivel = Math.max(
      0,
      Number(saldo.quantidade ?? 0) - Number(saldo.quantidade_reservada ?? 0),
    );
    saldoPorEndereco.set(
      saldo.endereco_id,
      (saldoPorEndereco.get(saldo.endereco_id) ?? 0) + disponivel,
    );
    const produto = Array.isArray(saldo.produto) ? saldo.produto[0] : saldo.produto;
    const produtoDim = produto as
      | { altura_cm?: number | null; largura_cm?: number | null; comprimento_cm?: number | null }
      | null
      | undefined;
    const volumeUnitario =
      Number(produtoDim?.altura_cm ?? 0) *
      Number(produtoDim?.largura_cm ?? 0) *
      Number(produtoDim?.comprimento_cm ?? 0);
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
    if (produto?.sku && disponivel > 0) {
      const set = skusPorEndereco.get(saldo.endereco_id) ?? new Set<string>();
      set.add(produto.sku);
      skusPorEndereco.set(saldo.endereco_id, set);
    }
    if (produto?.nome && disponivel > 0) {
      const unidade = unidadeLabel(
        (produto as { unidade_estocagem?: string | null }).unidade_estocagem,
      );
      const depositanteRel = Array.isArray(saldo.depositante)
        ? saldo.depositante[0]
        : saldo.depositante;
      const lista = produtosPorEndereco.get(saldo.endereco_id) ?? [];
      lista.push({
        nome: produto.nome,
        sku: produto.sku ?? "",
        quantidade: disponivel,
        unidade,
        imagemUrl:
          (produto as { imagem_principal_url?: string | null }).imagem_principal_url ?? null,
        depositante: (depositanteRel as { nome?: string } | null)?.nome ?? "",
      });
      produtosPorEndereco.set(saldo.endereco_id, lista);

      const unidadeSet = unidadesPorEndereco.get(saldo.endereco_id) ?? new Set<string>();
      unidadeSet.add(unidade);
      unidadesPorEndereco.set(saldo.endereco_id, unidadeSet);
    }
  }

  const enderecosData = enderecos ?? [];

  const rows = enderecosData.map((e) => {
    const q = saldoPorEndereco.get(e.id) ?? 0;
    const peso = pesoPorEndereco.get(e.id) ?? 0;
    const volume = volumePorEndereco.get(e.id) ?? 0;
    const cap = Number(e.capacidade_maxima ?? 0);
    const capPeso = Number(e.capacidade_peso_kg ?? 0);
    const altura = Number(e.altura_cm ?? 0);
    const largura = Number(e.largura_cm ?? 0);
    const comprimento = Number(e.comprimento_cm ?? 0);
    const volumeModo = (e.volume_modo as string | null) ?? null;
    const capVolume = volumeEndereco(volumeModo, altura, largura, comprimento, cap);
    const ocupacao = calcularOcupacao(peso, volume, capPeso, capVolume);
    return {
      id: e.id as string,
      codigo: e.codigo as string,
      area: e.area as string,
      descricao: (e.descricao as string | null) ?? "",
      rua: (e.rua as string | null) ?? "",
      modulo: (e.modulo as string | null) ?? "",
      ocupacao,
      skus: skusPorEndereco.get(e.id)?.size ?? 0,
      ativo: e.ativo as boolean,
      quantidade: q,
      peso,
      capacidadeMaxima: cap,
      capacidadePesoKg: capPeso,
      volumeModo: volumeModo ?? "",
      alturaCm: altura,
      larguraCm: largura,
      comprimentoCm: comprimento,
      unidadePadrao: (e.unidade_padrao as string | null) ?? "",
      unidadeSaldo: (() => {
        const set = unidadesPorEndereco.get(e.id);
        return set && set.size === 1 ? [...set][0] : "";
      })(),
      produtos: (produtosPorEndereco.get(e.id) ?? []).slice(0, 8),
    };
  });

  const enderecosAtivos = rows.filter((r) => r.ativo && r.area !== "BLOQUEADO");
  const enderecosComOcupacao = enderecosAtivos.filter((r) => r.ocupacao != null);
  const ocupacaoMedia = enderecosComOcupacao.length
    ? Math.round(
        enderecosComOcupacao.reduce((total, r) => total + (r.ocupacao ?? 0), 0) /
          enderecosComOcupacao.length,
      )
    : 0;
  const enderecosVazios = enderecosAtivos.filter((r) => r.quantidade <= 0).length;
  const enderecosBloqueados = rows.filter((r) => !r.ativo || r.area === "BLOQUEADO").length;

  const areasDisponiveis = Array.from(new Set(enderecosData.map((e) => e.area as string))).sort();

  return (
    <EnderecosView
      rows={rows}
      kpis={{
        total: enderecosData.length,
        ocupacaoMedia,
        vazios: enderecosVazios,
        bloqueados: enderecosBloqueados,
      }}
      areasDisponiveis={areasDisponiveis.length ? areasDisponiveis : ["PICKING", "PULMAO", "RECEBIMENTO", "EXPEDICAO", "QUARENTENA", "BLOQUEADO"]}
    />
  );
}
