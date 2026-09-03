"use client";

import { useMemo, useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { FIN_HEADING, FIN_MONO, FinBadge, Drawer, Kv, MiniKv, DrawerSection, insumoNomeFromDescricao } from "@/components/financeiro/fin-ui";

// Drawer de fatura reaproveitado tal e qual entre a aba Financeiro (admin) e
// a aba Faturas do portal do depositante — mesmo componente, mesmas
// informações, pra nunca desalinhar entre as duas telas.

export type FaturaDrawerFatura = {
  id: string;
  codigo: string;
  depNome: string;
  mesAno: string;
  status: string;
  valor: number;
  vencimento: string;
  boletoUrl: string | null;
  boletoNome: string | null;
};

export type FaturaDrawerExtratoRow = {
  tipo: string;
  descricao: string;
  valor: number;
  faturaId: string | null;
};

function fmt(v: number) {
  return "R$ " + (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBr(iso: string) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("pt-BR");
}

// Só para a Competência no drawer da fatura — nome do mês por extenso ("Agosto
// de 2026"), diferente da forma abreviada usada nas tabelas.
function formatMesAnoLongo(mesAno: string) {
  const [year, month] = mesAno.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[Number(month) - 1]} de ${year}`;
}

// Quantidade + unidade consumida, extraída do final da descrição do
// lançamento de insumo (ex: "Envelope de Segurança - 25x35 (3 un)" → 3 un) —
// usado para somar quanto foi utilizado de cada insumo no bloco do drawer.
function insumoQtdFromDescricao(descricao: string): { qtd: number; unidade: string } | null {
  const m = descricao.match(/\(([\d.,]+)\s*([^)]*)\)\s*$/);
  if (!m) return null;
  const qtd = Number(m[1].replace(",", "."));
  if (Number.isNaN(qtd)) return null;
  return { qtd, unidade: m[2].trim() };
}

function formatQtd(qtd: number): string {
  return qtd % 1 === 0 ? String(qtd) : qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// Lançamentos de ponto de coleta trazem o canal entre parênteses no final da
// descrição (ex: "Ponto de coleta PED-0042 (Mercado Livre Flex)") — usado
// para agrupar o bloco do drawer da fatura por ponto de coleta.
function canalFromDescricao(descricao: string): string | null {
  const m = descricao.match(/\(([^)]*)\)\s*$/);
  return m ? m[1].trim() || null : null;
}

// Título exibido no bloco do drawer da fatura, quando diferente do rótulo
// padrão do tipo (usado nas outras telas, como o extrato).
const BREAKDOWN_BLOCK_TITLE: Record<string, string> = {
  "Outro documento": "Outros documentos",
};

// Rótulo da contagem dentro de cada bloco do drawer da fatura — "Pedidos"
// para os tipos cobrados por pedido/evento de expedição ou recebimento,
// rótulo específico para os demais.
const BREAKDOWN_COUNT_LABEL: Record<string, string> = {
  Fulfillment: "Pedidos",
  "Ponto de coleta": "Pedidos",
  "Impressão NF": "Notas",
  "Carta de correção": "Pedidos com",
  "Outro documento": "Documentos",
  "Gestão de frete": "Pedidos",
  "Item adicional": "Pedidos",
  "Conferência unitária": "Pedidos",
  Urgência: "Pedidos",
  "Logística reversa": "Pedidos",
  Cancelamento: "Pedidos",
  Retirada: "Itens",
  Descarte: "Itens",
  Recebimento: "Recebimentos",
  Refrigerador: "Unidades",
  Insumo: "Insumos",
};
const BREAKDOWN_COUNT_LABEL_DEFAULT = "Lançamentos";

// Botão compacto ao lado de "Ver fatura completa": vermelho sem boleto
// anexado, verde quando já tem. Sobe o arquivo pela mesma rota que o
// FaturaUpload da página completa da fatura (/api/financeiro/faturas/[id]/upload).
function BoletoButton({
  faturaId,
  initialUrl,
  initialNome,
}: {
  faturaId: string;
  initialUrl: string | null;
  initialNome: string | null;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("tipo", "boleto");
      form.append("file", file);

      const res = await fetch(`/api/financeiro/faturas/${faturaId}/upload`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro no upload.");
        return;
      }

      setUrl(json.url);
    } catch {
      setError("Falha na conexão.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={initialNome ?? "Boleto anexado"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white transition hover:brightness-105"
      >
        <Paperclip className="h-4 w-4" />
      </a>
    );
  }

  return (
    <div className="relative shrink-0">
      <label
        title="Anexar boleto"
        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white transition hover:brightness-105 ${uploading ? "opacity-70" : "cursor-pointer"}`}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </label>
      {error && (
        <p className="absolute right-0 top-full mt-1 w-40 text-right text-[11px] text-red-500">{error}</p>
      )}
    </div>
  );
}

export function FaturaDrawer({
  fatura,
  extrato,
  onClose,
  showBoletoButton = true,
}: {
  fatura: FaturaDrawerFatura;
  extrato: FaturaDrawerExtratoRow[];
  onClose: () => void;
  showBoletoButton?: boolean;
}) {
  const breakdown = useMemo(() => {
    type SubGrupo = { nome: string; count: number; total: number; qtd: number; unidade: string };
    const grupos = new Map<string, { tipo: string; total: number; count: number; subGrupos: Map<string, SubGrupo> }>();
    for (const e of extrato) {
      if (e.faturaId !== fatura.id) continue;
      const g = grupos.get(e.tipo) ?? { tipo: e.tipo, total: 0, count: 0, subGrupos: new Map<string, SubGrupo>() };
      g.total += e.valor;
      g.count += 1;

      const subNome =
        e.tipo === "Ponto de coleta"
          ? canalFromDescricao(e.descricao)
          : e.tipo === "Insumo"
            ? insumoNomeFromDescricao(e.descricao)
            : null;
      if (subNome) {
        const sub = g.subGrupos.get(subNome) ?? { nome: subNome, count: 0, total: 0, qtd: 0, unidade: "" };
        sub.count += 1;
        sub.total += e.valor;
        if (e.tipo === "Insumo") {
          const qtdInfo = insumoQtdFromDescricao(e.descricao);
          if (qtdInfo) {
            sub.qtd += qtdInfo.qtd;
            sub.unidade = qtdInfo.unidade;
          }
        }
        g.subGrupos.set(subNome, sub);
      }

      grupos.set(e.tipo, g);
    }
    return Array.from(grupos.values())
      .map((g) => ({
        tipo: g.tipo,
        total: g.total,
        count: g.count,
        subGrupos: Array.from(g.subGrupos.values()).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [fatura.id, extrato]);

  return (
    <Drawer
      onClose={onClose}
      title={<span className={FIN_MONO}>{fatura.codigo}</span>}
      badge={<FinBadge status={fatura.status} />}
      footer={
        <div className="flex items-start gap-2">
          <a
            href={`/api/financeiro/faturas/${fatura.id}/relatorio`}
            className={`${FIN_HEADING} flex h-10 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-bold !text-white`}
          >
            Ver fatura completa
          </a>
          {showBoletoButton && (
            <BoletoButton faturaId={fatura.id} initialUrl={fatura.boletoUrl} initialNome={fatura.boletoNome} />
          )}
        </div>
      }
    >
      <Kv label="Depositante" value={fatura.depNome} />
      <Kv label="Competência" value={formatMesAnoLongo(fatura.mesAno)} />
      <Kv label="Vencimento" value={formatDateBr(fatura.vencimento)} />
      <Kv label="Valor" value={fmt(fatura.valor)} />
      {breakdown.map((g) => (
        <DrawerSection key={g.tipo} title={BREAKDOWN_BLOCK_TITLE[g.tipo] ?? g.tipo}>
          <MiniKv label="Valor total" value={fmt(g.total)} />
          <MiniKv label={BREAKDOWN_COUNT_LABEL[g.tipo] ?? BREAKDOWN_COUNT_LABEL_DEFAULT} value={String(g.count)} />
          {g.subGrupos.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1 border-t border-slate-200 pt-1.5 dark:border-white/10">
              {g.subGrupos.map((s) => (
                <MiniKv
                  key={s.nome}
                  label={s.nome}
                  value={
                    g.tipo === "Insumo"
                      ? `${formatQtd(s.qtd)}${s.unidade ? ` ${s.unidade}` : ""} · ${fmt(s.qtd > 0 ? s.total / s.qtd : s.total)}`
                      : String(s.count)
                  }
                />
              ))}
            </div>
          )}
        </DrawerSection>
      ))}
    </Drawer>
  );
}
