"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MobileBackButton,
  MobileButtonSpinner,
  MobileFullScreenLoader,
  MobileIcon,
  MobilePrimaryButton,
  hexAlpha,
  headingFont,
  mobileColors,
  mobileGradient,
} from "@/components/mobile/mobile-kit";

type Item = {
  id: string;
  produtoId: string;
  nome: string;
  sku: string;
  codigoExterno: string | null;
  codigoInterno: string | null;
  codigoExternoPack: string | null;
  imagemUrl: string | null;
  quantidadeSistema: number;
  quantidadeContada: number | null;
  divergencia: number;
  status: "PENDENTE" | "CONTADO" | "DIVERGENTE";
  atribuidoA: string | null;
  atribuidoNome: string | null;
  contadoPor: string | null;
  contadoEm: string | null;
};

type Detail = {
  id: string;
  depositante: string;
  dataOperacional: string;
  status: string;
  iniciadoEm: string;
  concluidoEm: string | null;
  totalItens: number;
  contados: number;
  pendentes: number;
  divergentes: number;
  zerados: number;
  aumentos: number;
  reducoes: number;
  itens: Item[];
};

type Summary = { divergentes: number; zerados: number; aumentos: number; reducoes: number; ajustesAplicados: number };

async function readResponse(response: Response) {
  const text = await response.text();
  let body: { result?: Detail; summary?: Summary; error?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
  if (!response.ok) throw new Error(body.error ?? "Não foi possivel concluir a operação.");
  return body;
}

const cardStyle = {
  border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
  borderRadius: 18,
  background: hexAlpha("#94A3B8", 0.045),
};

export function GeneralInventoryClient({ depositanteId, depositanteNome }: { depositanteId: string; depositanteNome: string }) {
  const router = useRouter();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [barcode, setBarcode] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = async (url: string, init?: RequestInit) => {
    const body = await readResponse(await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }));
    if (body.result) setDetail(body.result);
    return body;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/estoque/inventarios-gerais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depositanteId }),
    })
      .then(readResponse)
      .then((body) => {
        if (alive && body.result) setDetail(body.result);
      })
      .catch((reason) => alive && setError(reason instanceof Error ? reason.message : "Não foi possivel abrir o inventário."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [depositanteId]);

  useEffect(() => {
    if (!detail?.id || summary) return;
    const timer = window.setInterval(() => {
      fetch(`/api/estoque/inventarios-gerais?id=${detail.id}`)
        .then(readResponse)
        .then((body) => body.result && setDetail(body.result))
        .catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [detail?.id, summary]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return detail?.itens ?? [];
    return (detail?.itens ?? []).filter((item) => [item.nome, item.sku, item.codigoExterno, item.codigoInterno, item.codigoExternoPack].filter(Boolean).join(" ").toLocaleLowerCase().includes(term));
  }, [detail, search]);

  const activeItem = detail?.itens.find((item) => item.id === activeItemId) ?? null;
  const progress = detail?.totalItens ? Math.round((detail.contados / detail.totalItens) * 100) : 0;

  const chooseItem = async (item: Item) => {
    setError(null);
    if (item.status !== "PENDENTE") {
      setActiveItemId(item.id);
      setQuantity(String(item.quantidadeContada ?? ""));
      quantityRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = await load(`/api/estoque/inventarios-gerais/${detail?.id}`, { method: "POST", body: JSON.stringify({ action: "assumir", itemId: item.id }) });
      const next = body.result?.itens.find((entry) => entry.id === item.id);
      setActiveItemId(item.id);
      setQuantity(next?.quantidadeContada === null || next?.quantidadeContada === undefined ? "" : String(next.quantidadeContada));
      setTimeout(() => quantityRef.current?.focus(), 40);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Este produto ja foi assumido por outro operador.");
    } finally {
      setSaving(false);
    }
  };

  const scan = async () => {
    const code = barcode.trim().toLocaleLowerCase();
    if (!code || !detail) return;
    const item = detail.itens.find((entry) => [entry.sku, entry.codigoExterno, entry.codigoInterno, entry.codigoExternoPack].filter(Boolean).some((value) => value?.toLocaleLowerCase() === code));
    setBarcode("");
    if (!item) {
      setError("Produto não encontrado neste inventário.");
      barcodeRef.current?.focus();
      return;
    }
    await chooseItem(item);
  };

  const saveCount = async () => {
    if (!detail || !activeItem) return;
    const value = Number(quantity);
    if (!Number.isFinite(value) || value < 0) {
      setError("Informe uma quantidade válida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await load(`/api/estoque/inventarios-gerais/${detail.id}/itens/${activeItem.id}`, { method: "PATCH", body: JSON.stringify({ quantidade: value }) });
      setActiveItemId(null);
      setQuantity("");
      setTimeout(() => barcodeRef.current?.focus(), 40);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possivel salvar a contagem.");
    } finally {
      setSaving(false);
    }
  };

  const assumeNext = async () => {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      const body = await load(`/api/estoque/inventarios-gerais/${detail.id}`, { method: "POST", body: JSON.stringify({ action: "assumir" }) });
      const next = body.result?.itens.find((item) => item.id === (body as { claimedItemId?: string }).claimedItemId);
      if (next) await chooseItem(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não ha produto disponível para assumir.");
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!detail || detail.pendentes > 0) return;
    setSaving(true);
    setError(null);
    try {
      const body = await readResponse(await fetch(`/api/estoque/inventarios-gerais/${detail.id}/confirmar`, { method: "POST" }));
      setSummary(body.summary ?? null);
      setDetail((current) => current ? { ...current, status: "CONCLUIDO" } : current);
      setReview(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possivel concluir o inventário.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <MobileFullScreenLoader />;
  }

  if (summary && detail) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "18px", display: "flex", alignItems: "center", gap: 12 }}><MobileBackButton onClick={() => router.push("/m/estoque/inventarios/geral")} /><div><div style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário concluído</div><div style={{ fontSize: 12, color: mobileColors.muted }}>{detail.depositante}</div></div></div>
        <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px" }}>
          <div style={{ ...cardStyle, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ width: 68, height: 68, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: hexAlpha(mobileColors.green, 0.16), color: mobileColors.green }}><MobileIcon name="check" size={34} /></div>
            <div style={{ fontSize: 21, fontWeight: 800, ...headingFont }}>Contagem confirmada</div>
            <div style={{ fontSize: 13, color: mobileColors.muted, lineHeight: 1.5 }}>Os saldos divergentes foram ajustados e registrados no histórico do estoque.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[['Ajustes aplicados', summary.ajustesAplicados], ['Divergências', summary.divergentes], ['Aumentos', summary.aumentos], ['Reduções', summary.reducoes]].map(([label, value]) => <div key={String(label)} style={{ ...cardStyle, padding: 13 }}><div style={{ fontSize: 11, color: mobileColors.muted }}>{label}</div><div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, ...headingFont }}>{value}</div></div>)}
            </div>
            <a href={`/api/estoque/inventarios-gerais/${detail.id}/relatorio`} style={{ height: 52, borderRadius: 15, background: mobileGradient, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, textDecoration: "none" }}>Baixar relatório</a>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "18px", display: "flex", alignItems: "center", gap: 12 }}>
          <MobileBackButton onClick={() => router.push("/m/estoque/inventarios/geral")} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário geral</div>
            <div style={{ fontSize: 12, color: mobileColors.muted }}>{depositanteNome}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: "0 18px 18px", display: "flex", alignItems: "center" }}>
          <div style={{ ...cardStyle, width: "100%", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: hexAlpha(mobileColors.red, 0.14), color: mobileColors.redLight }}>
              <MobileIcon name="x" size={28} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, ...headingFont }}>Não foi possível abrir a contagem</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: mobileColors.muted }}>
              {error ?? "O inventário geral não retornou dados para este depositante."}
            </div>
            <MobilePrimaryButton onClick={() => window.location.reload()}>Tentar novamente</MobilePrimaryButton>
            <button
              type="button"
              onClick={() => router.push("/m/estoque/inventarios/geral")}
              style={{
                height: 48,
                borderRadius: 15,
                border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`,
                background: "transparent",
                color: mobileColors.text,
                fontWeight: 800,
              }}
            >
              Voltar para depositantes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: "16px 18px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <MobileBackButton onClick={() => router.push("/m/estoque/inventarios/geral")} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Inventário geral</div><div style={{ fontSize: 12, color: mobileColors.muted }}>{depositanteNome} - somente hoje</div></div>
        <span style={{ padding: "5px 10px", borderRadius: 999, background: hexAlpha(mobileColors.green, 0.14), color: mobileColors.green, fontSize: 10.5, fontWeight: 800 }}>EM CONTAGEM</span>
      </div>
      <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "end" }}><div><div style={{ fontSize: 12, color: mobileColors.muted }}>Progresso da contagem</div><div style={{ fontSize: 27, fontWeight: 800, ...headingFont }}>{detail.contados}/{detail.totalItens}</div></div><div style={{ fontSize: 19, fontWeight: 800, color: mobileColors.violetLight }}>{progress}%</div></div>
          <div style={{ height: 8, borderRadius: 999, background: hexAlpha("#94A3B8", 0.13), overflow: "hidden", marginTop: 10 }}><div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, background: mobileGradient, transition: "width .25s ease" }} /></div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}><span style={{ padding: "5px 9px", borderRadius: 999, background: hexAlpha(mobileColors.amber, .13), color: mobileColors.amber, fontSize: 11, fontWeight: 700 }}>{detail.pendentes} pendentes</span><span style={{ padding: "5px 9px", borderRadius: 999, background: hexAlpha(mobileColors.red, .13), color: mobileColors.redLight, fontSize: 11, fontWeight: 700 }}>{detail.divergentes} divergencias</span><span style={{ padding: "5px 9px", borderRadius: 999, background: hexAlpha(mobileColors.blue, .13), color: mobileColors.blueLight, fontSize: 11, fontWeight: 700 }}>Sem pausa</span></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={barcodeRef} value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void scan(); }} placeholder="Bipe SKU, EAN ou código interno" style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 14, border: `1px solid ${hexAlpha(mobileColors.cyan, .7)}`, background: hexAlpha("#94A3B8", .07), color: mobileColors.text, padding: "0 14px", fontSize: 13 }} />
          <button type="button" onClick={() => void scan()} style={{ width: 52, height: 48, borderRadius: 14, border: "none", background: mobileGradient, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MobileIcon name="scan" size={20} /></button>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar produto..." style={{ height: 44, borderRadius: 14, border: `1px solid ${hexAlpha("#94A3B8", .16)}`, background: hexAlpha("#94A3B8", .06), color: mobileColors.text, padding: "0 14px", fontSize: 13 }} />
        {error ? <div style={{ borderRadius: 14, padding: 12, background: hexAlpha(mobileColors.red, .12), border: `1px solid ${hexAlpha(mobileColors.red, .3)}`, color: mobileColors.redLight, fontSize: 12.5 }}>{error}</div> : null}
        {activeItem ? <div style={{ ...cardStyle, padding: 16, border: `1px solid ${mobileColors.cyan}` }}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><div style={{ width: 58, height: 58, borderRadius: 15, overflow: "hidden", background: hexAlpha(mobileColors.blue, .14), display: "flex", alignItems: "center", justifyContent: "center" }}>{activeItem.imagemUrl ? <img src={activeItem.imagemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <MobileIcon name="box" size={25} />}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800, ...headingFont }}>{activeItem.nome}</div><div style={{ color: mobileColors.muted, fontSize: 11.5 }}>{activeItem.sku} - sistema: {activeItem.quantidadeSistema}</div></div></div><div style={{ display: "flex", gap: 8, marginTop: 14 }}><input ref={quantityRef} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Quantidade contada" style={{ flex: 1, height: 48, borderRadius: 14, border: `1px solid ${mobileColors.cyan}`, background: hexAlpha("#94A3B8", .07), color: mobileColors.text, padding: "0 14px", fontSize: 16, fontWeight: 800 }} /><button type="button" disabled={saving} onClick={() => void saveCount()} style={{ minWidth: 112, border: "none", borderRadius: 14, background: mobileGradient, color: "#fff", fontWeight: 800 }}>{saving ? <MobileButtonSpinner /> : "Salvar"}</button></div></div> : null}
        <button type="button" disabled={saving || detail.pendentes === 0} onClick={() => void assumeNext()} style={{ height: 46, borderRadius: 14, border: `1px solid ${hexAlpha(mobileColors.violetLight, .35)}`, background: hexAlpha(mobileColors.violetLight, .09), color: mobileColors.violetLight, fontWeight: 800 }}>Assumir próximo produto</button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredItems.map((item) => <button type="button" key={item.id} onClick={() => void chooseItem(item)} style={{ ...cardStyle, width: "100%", padding: 13, display: "flex", alignItems: "center", gap: 10, textAlign: "left", color: mobileColors.text, borderColor: item.id === activeItemId ? mobileColors.cyan : hexAlpha("#94A3B8", .16) }}><div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: hexAlpha(mobileColors.blue, .13), display: "flex", alignItems: "center", justifyContent: "center" }}>{item.imagemUrl ? <img src={item.imagemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <MobileIcon name="box" size={19} />}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nome}</div><div style={{ color: mobileColors.muted, fontSize: 11 }}>{item.sku} - sistema {item.quantidadeSistema}</div>{item.atribuidoNome ? <div style={{ color: item.status === "PENDENTE" ? mobileColors.amber : mobileColors.green, fontSize: 10.5, marginTop: 2 }}>{item.status === "PENDENTE" ? `Com ${item.atribuidoNome}` : `Contado por ${item.contadoPor ?? item.atribuidoNome}`}</div> : null}</div><div style={{ flexShrink: 0, color: item.status === "PENDENTE" ? mobileColors.amber : item.status === "DIVERGENTE" ? mobileColors.redLight : mobileColors.green, fontSize: 11, fontWeight: 800 }}>{item.status === "PENDENTE" ? "Pendente" : item.divergencia === 0 ? "OK" : `${item.divergencia > 0 ? "+" : ""}${item.divergencia}`}</div></button>)}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: "10px 18px 18px", borderTop: `1px solid ${hexAlpha("#94A3B8", .12)}` }}>
        {!review ? <MobilePrimaryButton disabled={detail.pendentes > 0 || saving} onClick={() => setReview(true)}>{detail.pendentes > 0 ? `Faltam ${detail.pendentes} produtos` : "Revisar e confirmar inventário"}</MobilePrimaryButton> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><div style={{ ...cardStyle, padding: 12, fontSize: 12, color: mobileColors.muted }}>Ao confirmar: <strong style={{ color: mobileColors.text }}>{detail.divergentes} divergencias</strong>, <strong style={{ color: mobileColors.text }}>{detail.zerados} produtos zerados</strong>. Os saldos serão ajustados e auditados.</div><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => setReview(false)} style={{ flex: 1, height: 52, borderRadius: 15, border: `1px solid ${hexAlpha("#94A3B8", .2)}`, background: "transparent", color: mobileColors.text, fontWeight: 800 }}>Voltar</button><MobilePrimaryButton disabled={saving} onClick={() => void confirm()} style={{ flex: 1 }}>{saving ? <MobileButtonSpinner /> : "Confirmar ajustes"}</MobilePrimaryButton></div></div>}
      </div>
    </div>
  );
}
