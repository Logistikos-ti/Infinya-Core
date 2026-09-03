import type { RelatorioFaturaData } from "@/lib/relatorio-fatura";

function esc(v: string | number): string {
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function fmtBR(n: number, decimals = 2): string {
  return (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number): string {
  return "R$ " + fmtBR(n);
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

const DONUT_COLORS = ["var(--orange)", "var(--amber)", "var(--cyan)", "var(--lime)", "var(--coral)"];

export function renderRelatorioFaturaHtml(d: RelatorioFaturaData): string {
  const totalLogistica = d.totalLogistica || 1;
  const R = 82;
  const circ = 2 * Math.PI * R;
  let acc = 0;
  const arcs = d.servicos.map((s, i) => {
    const pct = s.valor / totalLogistica;
    const len = pct * circ;
    const offset = -acc;
    acc += len;
    return { ...s, pct, len, offset, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  const totalNfs = d.nfs.length;
  const temNfs = totalNfs > 0;
  const temInsumos = d.insumos.length > 0;
  const temRecebimentos = d.recebimentos.length > 0;

  const tabs: { num: string; label: string; count: number; target: string }[] = [
    { num: "01", label: "Resumo", count: d.servicos.length, target: "resumo" },
  ];
  if (temNfs) tabs.push({ num: "02", label: "NFs Processadas", count: totalNfs, target: "nfs" });
  if (temInsumos) tabs.push({ num: String(tabs.length + 1).padStart(2, "0"), label: "Insumos", count: d.insumos.length, target: "insumos" });
  if (temRecebimentos) tabs.push({ num: String(tabs.length + 1).padStart(2, "0"), label: "Recebimentos", count: d.recebimentos.length, target: "recebimentos" });

  const tabButtons = tabs
    .map(
      (t, i) => `<button class="tab-btn${i === 0 ? " active" : ""}" data-target="${t.target}"><span class="num">${t.num}</span>${esc(t.label)}<span class="count">${t.count}</span></button>`,
    )
    .join("");

  const kpiCards = [
    { label: "NFs Expedidas", value: d.kpis.nfsExpedidas, unit: "notas fiscais", accent: true },
    { label: "Ponto de Coleta", value: d.kpis.pontoColeta, unit: "pedidos" },
    { label: "Pallets Armazenados", value: d.kpis.palletsArmazenados, unit: "pallets · mês" },
    { label: "NFs Impressas", value: d.kpis.nfsImpressas, unit: "documentos" },
  ]
    .map(
      (k, i) => `<div class="kpi-cell${k.accent ? " accent" : ""}"><div class="corner">0${i + 1}</div><div class="label">${esc(k.label)}</div><div class="value">${fmtInt(k.value)}</div><div class="unit">${esc(k.unit)}</div></div>`,
    )
    .join("");

  const ticketMedio = totalNfs > 0 ? (d.valorExpedicao + d.valorPontoColeta) / totalNfs : 0;
  const volumeTotal = d.valorExpedicao + d.valorPontoColeta;

  const faturamentoCard = temNfs
    ? `
  <div class="fat-card">
    <div class="fat-card-grid-bg"></div>
    <div class="fat-left">
      <div class="fat-eyebrow"><span class="dot"></span>Volume Transacionado · ${esc(d.periodoMesAno)}</div>
      <h1 class="fat-headline">Faturamento <span class="ital">total</span> do cliente.</h1>
      <p class="fat-sub">Soma de todas as <strong>${totalNfs} notas fiscais</strong> processadas pela Infinoos WMS no período — operações de expedição + ponto de coleta consolidadas.</p>
      <div class="fat-meta">
        <div class="meta-item"><span class="l">Expedição</span><span class="v">${fmtCurrency(d.valorExpedicao)}</span><span class="x">${d.nfsExpedicaoCount} NFs</span></div>
        <div class="meta-item"><span class="l">Ponto de Coleta</span><span class="v">${fmtCurrency(d.valorPontoColeta)}</span><span class="x">${d.nfsPontoColetaCount} NFs</span></div>
        <div class="meta-item"><span class="l">Ticket Médio</span><span class="v">${fmtCurrency(ticketMedio)}</span><span class="x">por nota fiscal</span></div>
      </div>
    </div>
    <div class="fat-right">
      <div class="fat-bigval"><span class="cur">R$</span><span class="num">${fmtBR(volumeTotal, 0)}</span></div>
      <div class="fat-foot"><span class="dot"></span>Volume financeiro intermediado · ${totalNfs} NFs</div>
    </div>
  </div>`
    : "";

  const donutSvg = `
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--bg-3)" stroke-width="16"></circle>
        ${arcs
          .map(
            (a) =>
              `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${a.color}" stroke-width="16" stroke-dasharray="${a.len.toFixed(2)} ${(circ - a.len).toFixed(2)}" stroke-dashoffset="${a.offset.toFixed(2)}" transform="rotate(-90 100 100)" stroke-linecap="butt"></circle>`,
          )
          .join("")}
      </svg>
      <div class="center"><div class="v">${fmtCurrency(d.totalLogistica)}</div><div class="l">Total Logística</div></div>`;

  const compLegend = arcs
    .map(
      (a) =>
        `<div class="item"><span class="swatch" style="background:${a.color}"></span><span class="name">${esc(a.nome)}</span><span class="pct">${(a.pct * 100).toFixed(1)}%</span><span class="val">${fmtCurrency(a.valor)}</span></div>`,
    )
    .join("");

  const maxServico = Math.max(1, ...d.servicos.map((s) => s.valor));
  const serviceRows = d.servicos
    .map(
      (s) => `
    <div class="service-row">
      <div class="ico">${esc(s.id)}</div>
      <div class="name">${esc(s.nome)}<span class="detail">${s.detalhe ? `${esc(s.detalhe)} · ` : ""}<em>${esc(s.unitario)}</em></span></div>
      <div class="bar"><div class="bar-fill" style="width:${((s.valor / maxServico) * 100).toFixed(1)}%"></div></div>
      <div class="val">${fmtCurrency(s.valor)}</div>
    </div>`,
    )
    .join("");

  const calcLines = [`<div class="calc-line"><span class="lbl">Total Logística</span><span class="v">${fmtCurrency(d.totalLogistica)}</span></div>`];
  if (d.totalDescontos > 0) {
    calcLines.push(`<div class="calc-line credit"><span class="lbl">(-) Descontos</span><span class="v">- ${fmtCurrency(d.totalDescontos)}</span></div>`);
  }
  calcLines.push(
    `<div class="calc-line total"><span class="lbl">Total a Pagar</span><span class="v"><span class="currency">R$</span>${fmtBR(d.totalAPagar)}</span></div>`,
  );

  const nfRows = d.nfs
    .map(
      (n) => `
    <div class="row" data-transp="${esc(n.transp.toLowerCase())}" data-tipo="${n.tipo === "Ponto de Coleta" ? "col" : "exp"}">
      <span class="nf">${esc(n.nf)}</span>
      <span class="transp${n.transp === "Não informado" ? " empty" : ""}">${esc(n.transp)}</span>
      <span class="pill ${n.tipo === "Ponto de Coleta" ? "col" : "exp"}">${esc(n.tipo)}</span>
      <span class="val">${fmtCurrency(n.valor)}</span>
    </div>`,
    )
    .join("");

  const carrierCards = d.carriers
    .map(
      (c) => `
    <div class="carrier-card">
      <div class="rank">#${c.rank}</div>
      <div class="name">${esc(c.transp)}</div>
      <div class="type-tag ${c.tipoKey === "col" ? "coleta" : c.tipoKey === "mixed" ? "mixed" : ""}">${esc(c.tipoLabel)}</div>
      <div class="stats">
        <div class="stat"><div class="v orange">${fmtInt(c.count)}</div><div class="l">NFs</div></div>
        <div class="stat"><div class="v">${fmtCurrency(c.total)}</div><div class="l">Volume</div></div>
      </div>
    </div>`,
    )
    .join("");

  const insumoCards = d.insumos
    .map(
      (i) => `
    <div class="insumo-card">
      <div class="label">Insumo</div>
      <h4>${esc(i.nome)}</h4>
      <div class="row"><span class="l">Quantidade</span><span class="v">${fmtBR(i.qtd, i.qtd % 1 === 0 ? 0 : 2)} ${esc(i.unidade)}</span></div>
      <div class="row"><span class="l">Preço unitário</span><span class="v">${fmtCurrency(i.preco)}</span></div>
      <div class="total"><span class="l">Total</span><span class="v">${fmtCurrency(i.total)}</span></div>
    </div>`,
    )
    .join("");

  const recebimentoCards = d.recebimentos
    .map(
      (r) => `
    <div class="insumo-card">
      <div class="label">${r.data ? new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
      <h4>${esc(r.produto)}</h4>
      <div class="total"><span class="l">Quantidade recebida</span><span class="v">${fmtInt(r.quantidade)}</span></div>
    </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Infinoos WMS — Fechamento Financeiro · ${esc(d.periodo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #f4f5fb; --bg-1: #ffffff; --bg-2: #f1f3fa; --bg-3: #e7eaf6; --bg-4: #d9def0;
  --ink: #0b0f22; --ink-2: #151b36; --border: #e4e8f3; --border-2: #d3d9ec; --border-3: #b9c2df;
  --text: #0b0f22; --text-dim: #586083; --text-dimmer: #8e96b4;
  --orange: #4d5ef2; --orange-bright: #6d7dff; --orange-dim: rgba(77,94,242,.10); --orange-glow: rgba(77,94,242,.30);
  --lime: #0f9d6d; --lime-dim: rgba(15,157,109,.12);
  --coral: #e0455f; --amber: #8a4cf5; --cyan: #0ea3c8;
  --grad: linear-gradient(120deg, #22c3f0 0%, #4d5ef2 50%, #a24df5 100%);
  --shadow: 0 1px 2px rgba(11,15,34,.04), 0 16px 40px -20px rgba(77,94,242,.25);
  --shadow-hover: 0 2px 4px rgba(11,15,34,.05), 0 24px 48px -20px rgba(77,94,242,.35);
  --on-ink: #ffffff; --ink-text: #0b0f22; --lime-bg: #eefaf4; --lime-border: #c8eddc;
  --nav-bg: rgba(244,245,251,.72); --bg-rgb: 244,245,251; --r: 20px;
  --font-display: "Sora", system-ui, sans-serif; --font-mono: "IBM Plex Mono", Menlo, monospace;
}
:root[data-theme="dark"] {
  --bg: #080a12; --bg-1: #0f1324; --bg-2: #161b30; --bg-3: #1f2640; --bg-4: #2b3452;
  --ink: #1a2140; --ink-2: #222b4d; --border: #1f2740; --border-2: #2b3556; --border-3: #3b4770;
  --text: #f1f3fb; --text-dim: #9aa3c4; --text-dimmer: #667097;
  --orange: #6d7dff; --amber: #a978ff; --cyan: #3cc4e6; --lime: #4fd9a4;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 16px 40px -20px rgba(0,0,0,.6);
  --shadow-hover: 0 2px 4px rgba(0,0,0,.3), 0 24px 48px -20px rgba(109,125,255,.35);
  --on-ink: #ffffff; --ink-text: #f1f3fb; --lime-bg: rgba(79,217,164,.08); --lime-border: rgba(79,217,164,.25);
  --nav-bg: rgba(8,10,18,.72); --bg-rgb: 8,10,18;
}
html { transition: background .3s; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--bg); color: var(--text); font-family: var(--font-display); -webkit-font-smoothing: antialiased; overflow-x: hidden; min-height: 100vh; }
body::before { content: ""; position: fixed; inset: 0; background: radial-gradient(900px 520px at 8% -8%, rgba(34,195,240,.22), transparent 60%), radial-gradient(900px 560px at 55% -20%, rgba(77,94,242,.18), transparent 60%), radial-gradient(800px 500px at 100% 0%, rgba(162,77,245,.16), transparent 60%); pointer-events: none; z-index: 0; }
.grid-bg { position: fixed; inset: 0; background-image: radial-gradient(var(--border-3) 1px, transparent 1px); background-size: 28px 28px; mask-image: linear-gradient(180deg, black 0%, transparent 70%); -webkit-mask-image: linear-gradient(180deg, black 0%, transparent 70%); opacity: .55; pointer-events: none; z-index: 0; }
::selection { background: var(--orange); color: #fff; }
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; }
* { scrollbar-width: thin; scrollbar-color: var(--border-3) transparent; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 var(--orange-glow); } 50% { box-shadow: 0 0 0 7px transparent; } }
@keyframes pulseLime { 0%,100% { box-shadow: 0 0 0 0 rgba(15,157,109,.4); } 50% { box-shadow: 0 0 0 7px transparent; } }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes barGrow { from { width: 0 !important; } }
nav.top { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 14px 40px; background: var(--nav-bg); backdrop-filter: blur(18px) saturate(1.4); border-bottom: 1px solid var(--border); }
nav.top .brand { display: flex; align-items: center; gap: 18px; }
nav.top .brand-glyph { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: #071120; flex-shrink: 0; }
nav.top .brand-wordmark { display: inline-flex; flex-direction: column; gap: 2px; line-height: 1; }
nav.top .brand-wordmark .infinoos-label { font-family: var(--font-mono); font-size: 9.5px; font-weight: 500; letter-spacing: .34em; color: var(--ink-text); text-transform: uppercase; }
nav.top .brand-wordmark .wms { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -.01em; background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
nav.top .brand-divider { width: 1px; height: 22px; background: var(--border-2); }
nav.top .brand-sub { font-size: 13px; font-weight: 500; color: var(--text-dim); }
nav.top .status { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); letter-spacing: .06em; padding: 8px 14px; border: 1px solid var(--border-2); border-radius: 100px; background: var(--bg-1); }
nav.top .status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lime); animation: pulseLime 2s infinite; }
nav.top .nav-right { display: flex; align-items: center; gap: 10px; }
.theme-toggle { display: inline-flex; align-items: center; gap: 10px; padding: 5px 14px 5px 5px; border-radius: 100px; border: 1px solid var(--border-2); background: var(--bg-1); color: var(--text-dim); font-family: var(--font-mono); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; transition: border-color .2s, color .2s; }
.theme-toggle:hover { border-color: var(--orange); color: var(--text); }
.theme-toggle .tt-track { width: 44px; height: 24px; border-radius: 100px; background: var(--bg-3); position: relative; display: block; transition: background .3s; }
:root[data-theme="dark"] .theme-toggle .tt-track { background: var(--grad); }
.theme-toggle .tt-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--bg-1); display: grid; place-items: center; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .35s cubic-bezier(.22,1,.36,1); }
:root[data-theme="dark"] .theme-toggle .tt-thumb { transform: translateX(20px); }
.hero-header { position: relative; z-index: 2; padding: 88px 40px 0; max-width: 1400px; margin: 0 auto; animation: rise .7s cubic-bezier(.22,1,.36,1) both; }
.hero-header .eyebrow { display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 30px; }
.hero-header .eyebrow .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--grad); animation: pulse 2s infinite; }
.hero-header h1 { font-size: clamp(40px, 8.5vw, 100px); letter-spacing: -.055em; line-height: .95; font-weight: 700; margin-bottom: 26px; color: var(--ink-text); }
.hero-header h1 .ital { font-style: italic; font-weight: 300; background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; display: inline-block; padding-right: 0.16em; margin-right: -0.16em; }
.hero-header .subline { font-size: 18px; color: var(--text-dim); max-width: 640px; line-height: 1.55; }
.info-strip { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; margin-top: 56px; position: relative; z-index: 2; }
.info-strip .cell { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r); padding: 22px 24px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
.info-strip .cell .label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--text-dimmer); margin-bottom: 12px; }
.info-strip .cell .value { font-size: 20px; font-weight: 600; letter-spacing: -.02em; line-height: 1.2; }
.info-strip .cell .sub { font-size: 12.5px; color: var(--text-dim); margin-top: 5px; }
.info-strip .cell .sub.cnpj { font-family: var(--font-mono); color: var(--orange); letter-spacing: .04em; font-size: 11.5px; }
.info-strip .cell.status { background: var(--grad); border: none; color: #fff; display: flex; flex-direction: column; justify-content: center; gap: 10px; box-shadow: 0 10px 24px -10px rgba(109,125,255,.5); }
.info-strip .cell.status .label { color: rgba(255,255,255,.7); }
.info-strip .cell .status-tag { display: inline-flex; align-items: center; gap: 12px; font-family: var(--font-display); font-size: 28px; font-weight: 700; color: #fff; }
.info-strip .cell .status-tag::before { content: ""; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 0 16px 2px rgba(255,255,255,.6); animation: pulseLime 2s infinite; flex-shrink: 0; }
.tabs { position: sticky; top: 63px; z-index: 50; padding: 16px 40px; margin-top: 48px; background: linear-gradient(180deg, rgba(var(--bg-rgb),.95), rgba(var(--bg-rgb),.6)); backdrop-filter: blur(14px); }
.tabs-inner { max-width: 1400px; margin: 0 auto; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 5px; background: var(--bg-1); border: 1px solid var(--border-2); border-radius: 100px; width: max-content; box-shadow: var(--shadow); }
.tab-btn { font-family: var(--font-display); font-size: 13.5px; font-weight: 500; padding: 10px 18px 10px 14px; background: transparent; border: none; border-radius: 100px; color: var(--text-dim); display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.tab-btn .num { font-family: var(--font-mono); font-size: 10px; color: var(--text-dimmer); letter-spacing: .06em; }
.tab-btn .count { font-family: var(--font-mono); background: var(--bg-2); color: var(--text-dim); font-size: 10.5px; padding: 3px 8px; border-radius: 100px; }
.tab-btn.active { color: #fff; background: var(--grad); box-shadow: 0 6px 18px -6px rgba(109,125,255,.5); }
.tab-btn.active .num { color: rgba(255,255,255,.7); }
.tab-btn.active .count { background: rgba(255,255,255,.14); color: var(--on-ink); }
.tab-content { display: none; position: relative; z-index: 2; max-width: 1400px; margin: 0 auto; padding: 32px 40px 80px; animation: rise .5s cubic-bezier(.22,1,.36,1) both; }
.tab-content.active { display: block; }
.section-header { display: flex; align-items: baseline; gap: 16px; margin: 8px 0 20px; padding: 0 4px; }
.section-header .num { font-family: var(--font-mono); font-size: 11px; color: var(--orange); letter-spacing: .1em; }
.section-header .title { font-size: 15px; font-weight: 600; color: var(--ink-text); }
.section-header .meta { margin-left: auto; font-family: var(--font-mono); font-size: 11px; color: var(--text-dimmer); }
.kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 44px; }
.kpi-cell { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r); padding: 26px 26px 24px; position: relative; overflow: hidden; min-height: 168px; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.kpi-cell .label { font-size: 13px; font-weight: 500; color: var(--text-dim); margin-bottom: auto; }
.kpi-cell .value { font-family: var(--font-display); font-size: 54px; letter-spacing: -.05em; font-weight: 600; line-height: 1; color: var(--ink-text); margin-top: 22px; }
.kpi-cell .unit { font-family: var(--font-mono); font-size: 11px; color: var(--text-dimmer); margin-top: 10px; text-transform: uppercase; letter-spacing: .08em; }
.kpi-cell.accent { background: var(--grad); border: none; box-shadow: 0 10px 24px -10px rgba(109,125,255,.5); }
.kpi-cell.accent .label { color: rgba(255,255,255,.7); }
.kpi-cell.accent .value, .kpi-cell.accent .unit { color: #fff; }
.kpi-cell.accent .unit { color: rgba(255,255,255,.65); }
.kpi-cell .corner { position: absolute; top: 18px; right: 20px; font-family: var(--font-mono); font-size: 10px; color: var(--text-dimmer); }
.fat-card { position: relative; display: grid; grid-template-columns: 1.2fr 1fr; gap: 0; background: linear-gradient(var(--bg-1), var(--bg-1)) padding-box, var(--grad) border-box; border: 1.5px solid transparent; border-radius: var(--r); overflow: hidden; margin-bottom: 44px; isolation: isolate; box-shadow: 0 30px 70px -30px rgba(77,94,242,.45); }
.fat-card-grid-bg { position: absolute; inset: 0; background-image: radial-gradient(var(--border-2) 1px, transparent 1px); background-size: 22px 22px; mask-image: radial-gradient(ellipse 55% 90% at 82% 50%, black 0%, transparent 75%); opacity: .8; pointer-events: none; z-index: 0; }
.fat-card::after { content: ""; position: absolute; top: -140px; right: -100px; width: 420px; height: 420px; background: radial-gradient(circle, rgba(162,77,245,.28), rgba(77,94,242,.16) 45%, transparent 70%); pointer-events: none; z-index: 0; }
.fat-left { padding: 38px 40px 36px; position: relative; z-index: 1; border-right: 1px solid var(--border); }
.fat-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .12em; color: var(--orange); padding: 7px 14px; background: var(--orange-dim); border-radius: 100px; margin-bottom: 24px; }
.fat-eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); animation: pulse 2s infinite; }
.fat-headline { font-size: clamp(26px, 3.6vw, 38px); font-weight: 700; letter-spacing: -.04em; line-height: 1.05; margin-bottom: 16px; color: var(--ink-text); }
.fat-headline .ital { font-style: italic; font-weight: 300; background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; display: inline-block; padding-right: 0.16em; margin-right: -0.16em; }
.fat-sub { font-size: 15px; line-height: 1.6; color: var(--text-dim); max-width: 56ch; margin-bottom: 30px; }
.fat-sub strong { color: var(--ink-text); font-weight: 600; }
.fat-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.fat-meta .meta-item { background: var(--bg-2); border-radius: 14px; padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 4px; }
.fat-meta .meta-item .l { font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em; color: var(--text-dimmer); }
.fat-meta .meta-item .v { font-family: var(--font-mono); font-size: 16px; font-weight: 500; color: var(--ink-text); margin-top: 4px; }
.fat-meta .meta-item .x { font-size: 11.5px; color: var(--text-dim); margin-top: 2px; }
.fat-right { padding: 38px 40px; position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 24px; }
.fat-bigval { display: flex; align-items: baseline; gap: 12px; }
.fat-bigval .cur { font-family: var(--font-mono); font-size: 22px; color: var(--text-dim); }
.fat-bigval .num { font-family: var(--font-display); font-size: clamp(42px, 5.8vw, 68px); font-weight: 700; letter-spacing: -.06em; line-height: .95; color: var(--ink-text); }
.fat-foot { font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .12em; color: var(--text-dim); display: inline-flex; align-items: center; gap: 10px; padding-top: 18px; border-top: 1px solid var(--border); width: 100%; }
.fat-foot .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--lime); animation: pulseLime 2s infinite; }
@media (max-width: 760px) { .fat-card { grid-template-columns: 1fr; } .fat-left { border-right: none; border-bottom: 1px solid var(--border); } .fat-meta { grid-template-columns: 1fr; } }
.comp-chart { display: grid; grid-template-columns: auto 1fr; gap: 44px; background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r); padding: 32px 36px; margin-bottom: 44px; align-items: center; box-shadow: var(--shadow); }
.comp-chart .donut { width: 220px; height: 220px; position: relative; flex-shrink: 0; }
.comp-chart .donut .center { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.comp-chart .donut .center .v { font-family: var(--font-display); font-size: 20px; font-weight: 600; letter-spacing: -.03em; line-height: 1.15; color: var(--ink-text); }
.comp-chart .donut .center .l { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: var(--text-dim); margin-top: 5px; }
.comp-chart .legend { display: flex; flex-direction: column; gap: 4px; }
.comp-chart .legend .item { display: grid; grid-template-columns: 10px 1fr auto auto; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.comp-chart .legend .item:last-child { border-bottom: none; }
.comp-chart .legend .swatch { width: 10px; height: 10px; border-radius: 50%; }
.comp-chart .legend .name { font-size: 14.5px; font-weight: 500; }
.comp-chart .legend .pct { font-family: var(--font-mono); font-size: 11px; color: var(--text-dimmer); }
.comp-chart .legend .val { font-family: var(--font-mono); font-size: 14px; font-weight: 500; min-width: 110px; text-align: right; }
@media (max-width: 980px) { .comp-chart { grid-template-columns: 1fr; } }
.fin-summary { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-bottom: 44px; }
.fin-summary .services { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r); padding: 30px 32px; box-shadow: var(--shadow); }
.fin-summary h3 { font-size: 13px; font-weight: 600; color: var(--ink-text); margin-bottom: 18px; }
.service-row { display: grid; grid-template-columns: 32px 1fr 160px 140px; align-items: center; gap: 18px; padding: 15px 0; border-bottom: 1px solid var(--border); }
.service-row:last-child { border-bottom: none; }
.service-row .ico { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--orange-dim); color: var(--orange); font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; }
.service-row .name { font-size: 14.5px; font-weight: 500; }
.service-row .name .detail { display: block; font-size: 12px; color: var(--text-dim); margin-top: 3px; }
.service-row .name .detail em { font-style: normal; color: var(--orange); font-weight: 500; font-family: var(--font-mono); font-size: 11.5px; }
.service-row .bar { height: 6px; background: var(--bg-3); border-radius: 3px; overflow: hidden; }
.service-row .bar-fill { height: 100%; background: var(--grad); border-radius: 3px; animation: barGrow 1.2s cubic-bezier(.22,1,.36,1) both; }
.service-row .val { font-family: var(--font-mono); font-size: 14px; text-align: right; font-weight: 500; }
.fin-summary .total-block { background: var(--grad); color: #fff; border: none; border-radius: var(--r); padding: 32px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 24px -10px rgba(109,125,255,.5); }
.calc-line { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.25); }
.calc-line .lbl { font-size: 12.5px; color: #fff; flex: 1; min-width: 0; padding-right: 20px; line-height: 1.5; font-family: var(--font-display); }
.calc-line .v { font-family: var(--font-mono); font-size: 15px; font-weight: 500; flex-shrink: 0; white-space: nowrap; text-align: right; color: #fff; }
.calc-line.total { border-bottom: none; padding-top: 26px; align-items: flex-end; }
.calc-line.total .lbl { font-size: 12px; color: #fff; font-weight: 500; text-transform: uppercase; letter-spacing: .12em; font-family: var(--font-mono); }
.calc-line.total .v { font-family: var(--font-display); font-size: 40px; font-weight: 600; letter-spacing: -.045em; line-height: .95; color: #fff; }
.calc-line.total .v .currency { font-size: 17px; vertical-align: top; margin-right: 6px; opacity: .8; font-family: var(--font-mono); font-weight: 400; }
@media (max-width: 980px) { .fin-summary { grid-template-columns: 1fr; } }
.table-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.table-controls .search { flex: 1; min-width: 240px; position: relative; }
.table-controls .search input { width: 100%; background: var(--bg-1); border: 1px solid var(--border-2); border-radius: 100px; padding: 13px 18px 13px 40px; color: var(--text); font-family: var(--font-display); font-size: 14px; outline: none; box-shadow: var(--shadow); }
.table-controls .search input:focus { border-color: var(--orange); box-shadow: 0 0 0 4px var(--orange-dim); }
.table-controls .search::before { content: "⌕"; position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 18px; pointer-events: none; }
.filter-chip { font-family: var(--font-display); font-size: 13px; font-weight: 500; padding: 10px 16px; border-radius: 100px; background: var(--bg-1); border: 1px solid var(--border-2); color: var(--text-dim); transition: all .15s; }
.filter-chip:hover { color: var(--text); border-color: var(--border-3); }
.filter-chip.active { background: var(--grad); border: none; color: #fff; box-shadow: 0 6px 18px -6px rgba(109,125,255,.5); }
.nf-table { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; box-shadow: var(--shadow); margin-bottom: 44px; }
.nf-table .head, .nf-table .row { display: grid; grid-template-columns: 120px 1fr 130px 150px; align-items: center; padding: 13px 24px; gap: 16px; }
.nf-table .head { background: var(--bg-2); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--text-dimmer); border-bottom: 1px solid var(--border); }
.nf-table .body { max-height: 540px; overflow-y: auto; }
.nf-table .row { border-bottom: 1px solid var(--border); font-size: 13.5px; }
.nf-table .row:last-child { border-bottom: none; }
.nf-table .row .nf { font-family: var(--font-mono); color: var(--orange); font-weight: 500; }
.nf-table .row .transp.empty { color: var(--text-dimmer); font-style: italic; }
.nf-table .row .pill { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; padding: 4px 10px; border-radius: 100px; display: inline-flex; align-items: center; gap: 6px; width: max-content; }
.nf-table .row .pill.exp { background: rgba(14,163,200,.12); color: #0a7f9c; }
.nf-table .row .pill.col { background: rgba(138,76,245,.12); color: #6f35d1; }
.nf-table .row .val { font-family: var(--font-mono); font-size: 14px; text-align: right; font-weight: 500; }
.nf-table .empty-state { padding: 60px 20px; text-align: center; color: var(--text-dim); font-size: 13px; }
.carrier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.carrier-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r); padding: 22px 22px 20px; position: relative; min-height: 170px; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.carrier-card .rank { position: absolute; top: 16px; right: 18px; font-family: var(--font-mono); font-size: 10px; color: var(--text-dimmer); }
.carrier-card .name { font-size: 15px; font-weight: 600; line-height: 1.25; margin-bottom: 6px; padding-right: 40px; min-height: 36px; }
.carrier-card .type-tag { font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 18px; display: inline-flex; align-items: center; gap: 7px; }
.carrier-card .type-tag::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--cyan); }
.carrier-card .type-tag.coleta::before { background: var(--amber); }
.carrier-card .type-tag.mixed::before { background: var(--orange); }
.carrier-card .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: auto; }
.carrier-card .stat .v { font-family: var(--font-display); font-size: 24px; font-weight: 600; letter-spacing: -.03em; line-height: 1; }
.carrier-card .stat .v.orange { color: var(--orange); }
.carrier-card .stat .l { font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--text-dimmer); margin-top: 7px; }
.insumo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.insumo-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r); padding: 24px; box-shadow: var(--shadow); }
.insumo-card .label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--text-dimmer); margin-bottom: 12px; }
.insumo-card h4 { font-size: 16px; font-weight: 600; margin-bottom: 18px; line-height: 1.3; }
.insumo-card .row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.insumo-card .row .l { color: var(--text-dim); font-size: 12.5px; }
.insumo-card .row .v { color: var(--text); font-family: var(--font-mono); }
.insumo-card .total { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-2); display: flex; justify-content: space-between; align-items: baseline; }
.insumo-card .total .l { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--orange); }
.insumo-card .total .v { font-family: var(--font-display); font-size: 22px; font-weight: 600; letter-spacing: -.03em; color: var(--orange); }
.back-top-wrap { margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 28px; }
.back-top { position: relative; display: inline-flex; align-items: center; gap: 14px; font-family: var(--font-display); font-size: 13.5px; font-weight: 500; color: #fff; padding: 10px 22px 10px 10px; background: var(--ink); border: none; border-radius: 100px; cursor: pointer; outline: none; overflow: hidden; isolation: isolate; transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .3s; box-shadow: 0 16px 32px -16px rgba(11,15,34,.6); }
.back-top::before { content: ""; position: absolute; inset: -1px; border-radius: 100px; background: var(--grad); opacity: 0; transition: opacity .3s; z-index: 0; }
.back-top .arrow-up, .back-top .lbl-main, .back-top .lbl-meta { position: relative; z-index: 1; }
.back-top:hover { transform: translateY(-2px); box-shadow: 0 20px 40px -12px rgba(77,94,242,.6); }
.back-top:hover::before { opacity: 1; }
.back-top .arrow-up { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.14); display: grid; place-items: center; color: #fff; transition: transform .45s cubic-bezier(.22,1,.36,1), background .2s; }
.back-top:hover .arrow-up { background: #fff; color: #0b0f22; transform: translateY(-2px); }
.back-top .lbl-meta { font-family: var(--font-mono); font-size: 10px; color: rgba(255,255,255,.6); padding-left: 12px; border-left: 1px solid rgba(255,255,255,.2); letter-spacing: .14em; }
footer { position: relative; z-index: 2; border-top: 1px solid var(--border); padding: 36px 40px; margin-top: 40px; text-align: center; font-family: var(--font-mono); font-size: 11px; color: var(--text-dimmer); letter-spacing: .04em; }
footer .slogan { margin-bottom: 10px; font-family: var(--font-display); font-size: 15px; font-weight: 500; background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; display: block; }
@media (max-width: 980px) {
  .info-strip, .kpi-strip { grid-template-columns: repeat(2, 1fr); }
  .hero-header h1 { font-size: 44px; }
  .nf-table .head, .nf-table .row { grid-template-columns: 90px 1fr 100px; gap: 10px; padding: 12px; font-size: 12px; }
  .nf-table .row .val, .nf-table .head > :last-child { display: none; }
  nav.top, .hero-header, .tabs, .tab-content { padding-left: 20px; padding-right: 20px; }
}
</style>
</head>
<body>
<div class="grid-bg"></div>

<nav class="top">
  <div class="brand">
    <div class="brand-glyph">
      <svg viewBox="0 0 120 96" width="20" height="16">
        <defs>
          <linearGradient id="ggrad" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0" stop-color="#38bdf8"></stop><stop offset="0.5" stop-color="#4f6cf7"></stop><stop offset="1" stop-color="#a855f7"></stop>
          </linearGradient>
        </defs>
        <path d="M20,62 C20,40 46,40 60,62 C74,84 100,84 100,62 C100,40 74,40 60,62 C46,84 20,84 20,62 Z" fill="none" stroke="url(#ggrad)" stroke-width="10.5"></path>
        <path d="M20,62 C20,40 46,40 60,62 C74,84 100,84 100,62 C100,40 74,40 60,62 C46,84 20,84 20,62 Z" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="2.8"></path>
        <path d="M44,33 L44,14 L60,4 L76,14 L76,33 Z" fill="url(#ggrad)"></path>
        <path d="M44,14 L60,4 L76,14" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></path>
        <path d="M53,33 L53,21 L67,21 L67,33" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.4" stroke-linejoin="round"></path>
      </svg>
    </div>
    <div class="brand-wordmark"><span class="infinoos-label">Infinoos</span><span class="wms">WMS</span></div>
    <div class="brand-divider"></div>
    <span class="brand-sub">Fechamento Financeiro</span>
  </div>
  <div class="nav-right">
    <div class="status"><span class="dot"></span>DOC · ${esc(d.codigo)}</div>
    <button class="theme-toggle" id="themeToggle"><span>Claro</span><span class="tt-track"><span class="tt-thumb">☀</span></span></button>
  </div>
</nav>

<header class="hero-header">
  <div class="eyebrow"><span class="dot"></span>Documento · Fechamento Mensal · ${esc(d.periodoRef)}</div>
  <h1>Fechamento<br><span class="ital">Financeiro</span>.</h1>
  <p class="subline">Resumo consolidado das operações logísticas executadas em ${esc(d.periodo)} para ${esc(d.cliente)}.</p>

  <div class="info-strip">
    <div class="cell">
      <div class="label">Cliente</div>
      <div class="value">${esc(d.cliente)}</div>
      <div class="sub">${esc(d.razaoSocial)}</div>
      <div class="sub cnpj">CNPJ · ${esc(d.cnpj)}</div>
    </div>
    <div class="cell">
      <div class="label">Período</div>
      <div class="value">${esc(d.periodo)}</div>
      <div class="sub">REF · ${esc(d.periodoRef)}</div>
    </div>
    <div class="cell">
      <div class="label">Emitido em</div>
      <div class="value">${esc(d.emitido)}</div>
      <div class="sub">via Infinoos WMS</div>
    </div>
    <div class="cell status">
      <div class="label">Status</div>
      <div class="status-tag">${esc(d.status)}</div>
    </div>
  </div>
</header>

<div class="tabs"><div class="tabs-inner">${tabButtons}</div></div>

<div class="tab-content active" id="tab-resumo">
  <div class="section-header"><span class="num">01.A</span><span class="title">Indicadores do Mês</span><span class="meta">04 métricas</span></div>
  <div class="kpi-strip">${kpiCards}</div>

  ${
    temNfs
      ? `<div class="section-header" style="margin-top:40px"><span class="num">01.B</span><span class="title">Faturamento Total · NFs Intermediadas</span><span class="meta">${totalNfs} NFs · ${fmtCurrency(volumeTotal)}</span></div>
  ${faturamentoCard}`
      : ""
  }

  <div class="section-header"><span class="num">01.C</span><span class="title">Composição da Logística</span><span class="meta">Total · ${fmtCurrency(d.totalLogistica)}</span></div>
  <div class="comp-chart">
    <div class="donut">${donutSvg}</div>
    <div class="legend">${compLegend}</div>
  </div>

  <div class="section-header"><span class="num">01.D</span><span class="title">Serviços Faturados</span><span class="meta">${d.servicos.length} linhas · ${fmtCurrency(d.totalAPagar)} a pagar</span></div>
  <div class="fin-summary">
    <div class="services">
      <h3>Detalhamento de Serviços</h3>
      ${serviceRows}
    </div>
    <div class="total-block">${calcLines.join("")}</div>
  </div>
</div>

${
  temNfs
    ? `<div class="tab-content" id="tab-nfs">
  <div class="section-header"><span class="num">02.A</span><span class="title">Notas Fiscais Processadas</span><span class="meta">${totalNfs} NFs</span></div>
  <div class="table-controls">
    <div class="search"><input type="text" id="nfSearch" placeholder="Buscar por NF ou transportadora..."></div>
    <button class="filter-chip active" data-filter="all">Todas</button>
    <button class="filter-chip" data-filter="exp">Expedição</button>
    <button class="filter-chip" data-filter="col">Ponto de Coleta</button>
  </div>
  <div class="nf-table">
    <div class="head"><span>NF</span><span>Transportadora</span><span>Tipo</span><span style="text-align:right">Valor</span></div>
    <div class="body" id="nfBody">${nfRows || '<div class="empty-state">Nenhuma NF processada neste período.</div>'}</div>
  </div>

  <div class="section-header" style="margin-top:36px"><span class="num">02.B</span><span class="title">Transportadoras</span><span class="meta">${d.carriers.length} transportadoras</span></div>
  <div class="carrier-grid">${carrierCards}</div>
</div>`
    : ""
}

${
  temInsumos
    ? `<div class="tab-content" id="tab-insumos">
  <div class="section-header"><span class="num">${tabs.find((t) => t.target === "insumos")?.num}.A</span><span class="title">Insumos Consumidos</span><span class="meta">${d.insumos.length} insumos</span></div>
  <div class="insumo-grid">${insumoCards}</div>
</div>`
    : ""
}

${
  temRecebimentos
    ? `<div class="tab-content" id="tab-recebimentos">
  <div class="section-header"><span class="num">${tabs.find((t) => t.target === "recebimentos")?.num}.A</span><span class="title">Itens Recebidos</span><span class="meta">${d.recebimentos.length} itens</span></div>
  <div class="insumo-grid">${recebimentoCards}</div>
</div>`
    : ""
}

<div class="back-top-wrap">
  <button class="back-top" id="backTop">
    <span class="arrow-up">↑</span>
    <span class="lbl-main">Voltar ao topo</span>
    <span class="lbl-meta">TOP</span>
  </button>
</div>

<footer>
  <span class="slogan">Evolua sua operação do manual ao autônomo.</span>
  Documento gerado automaticamente · Infinoos WMS · Fechamento Financeiro · ${esc(d.cliente)} · ${esc(d.periodoRef)}
</footer>

<script>
document.querySelectorAll('.tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    btn.classList.add('active');
    var target = document.getElementById('tab-' + btn.dataset.target);
    if (target) target.classList.add('active');
  });
});

var themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var label = themeToggle.querySelector('span');
  var thumb = themeToggle.querySelector('.tt-thumb');
  if (label) label.textContent = theme === 'dark' ? 'Escuro' : 'Claro';
  if (thumb) thumb.textContent = theme === 'dark' ? '☾' : '☀';
}
var savedTheme = 'light';
try { savedTheme = localStorage.getItem('relatorio-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) {}
applyTheme(savedTheme);
themeToggle.addEventListener('click', function () {
  var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('relatorio-theme', next); } catch (e) {}
});

var nfSearch = document.getElementById('nfSearch');
var nfBody = document.getElementById('nfBody');
var activeFilter = 'all';
function applyNfFilters() {
  if (!nfBody) return;
  var q = (nfSearch && nfSearch.value ? nfSearch.value : '').toLowerCase().trim();
  Array.prototype.forEach.call(nfBody.querySelectorAll('.row'), function (row) {
    var matchesFilter = activeFilter === 'all' || row.dataset.tipo === activeFilter;
    var matchesSearch = !q || row.dataset.transp.indexOf(q) !== -1 || row.querySelector('.nf').textContent.toLowerCase().indexOf(q) !== -1;
    row.style.display = matchesFilter && matchesSearch ? '' : 'none';
  });
}
if (nfSearch) nfSearch.addEventListener('input', applyNfFilters);
document.querySelectorAll('.filter-chip').forEach(function (chip) {
  chip.addEventListener('click', function () {
    document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    applyNfFilters();
  });
});

var backTop = document.getElementById('backTop');
if (backTop) backTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
</script>
</body>
</html>`;
}
