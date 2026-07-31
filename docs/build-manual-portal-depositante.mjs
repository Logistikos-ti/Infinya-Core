import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = "C:\\Users\\admin\\OneDrive\\Desktop\\Claude\\Projects & Softwares\\Our WMS\\wms-evolveg";
const iconDataUri = fs.readFileSync(path.join(root, "scratch", "icon-b64.txt"), "utf8").trim();
const lockupDataUri = fs.readFileSync(path.join(root, "scratch", "lockup-b64.txt"), "utf8").trim();

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');

:root{
  --navy-950:#050b19;
  --navy-900:#071120;
  --navy-800:#0a1120;
  --navy-700:#0c1424;
  --navy-600:#101b30;
  --sky:#38bdf8;
  --blue:#3B82F6;
  --violet:#8B5CF6;
  --purple:#a855f7;
  --emerald:#10B981;
  --amber:#F59E0B;
  --rose:#EF4444;
  --slate:#64748B;
  --ink:#0f172a;
  --muted:#64748b;
  --line:#e2e8f0;
  --paper:#f7f8fc;
  --brand-grad: linear-gradient(92deg,#3B82F6,#8B5CF6);
  --brand-grad-3: linear-gradient(92deg,#38bdf8,#4f6cf7,#a855f7);
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{
  font-family:'Inter',system-ui,sans-serif;
  color:var(--ink);
  background:#fff;
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3,h4,.disp{ font-family:'Space Grotesk','Inter',sans-serif; letter-spacing:-0.01em; }
.page{
  width:210mm;
  min-height:289mm;
  position:relative;
  page-break-after:always;
  overflow:hidden;
  padding:16mm 16mm 20mm 16mm;
}
.page:last-child{ page-break-after:auto; }
.page.cover{ display:flex; padding:0; height:289mm; }

/* ---------- COVER ---------- */
.cover, .end{
  flex:1;
  width:100%;
  padding:0;
  background:
    radial-gradient(circle at 18% 14%, rgba(56,189,248,0.30), transparent 32%),
    radial-gradient(circle at 86% 20%, rgba(168,85,247,0.28), transparent 34%),
    radial-gradient(circle at 30% 92%, rgba(79,108,247,0.22), transparent 40%),
    linear-gradient(180deg,var(--navy-950) 0%, var(--navy-900) 60%, #060c1a 100%);
  color:#fff;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
}
.cover-top{ padding:20mm 18mm 0 18mm; display:flex; align-items:center; gap:10mm; }
.cover-mark{ width:24mm; height:19.2mm; filter:drop-shadow(0 6px 18px rgba(56,189,248,0.35)); }
.cover-wordmark{ height:13mm; width:auto; }
.cover-mid{
  flex:1;
  display:flex;
  flex-direction:column;
  justify-content:center;
  padding:0 18mm;
}
.cover-eyebrow{
  display:inline-flex; width:fit-content; align-items:center; gap:8px;
  font-size:10.5px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase;
  color:#bcdcff; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16);
  padding:6px 14px; border-radius:999px; margin-bottom:9mm;
}
.cover-eyebrow .dot{ width:6px; height:6px; border-radius:999px; background:var(--brand-grad-3); }
.cover-title{ font-size:40px; font-weight:700; line-height:1.08; margin:0 0 6mm 0; max-width:150mm; }
.cover-title .grad{
  background:var(--brand-grad-3); -webkit-background-clip:text; background-clip:text; color:transparent;
}
.cover-sub{ font-size:14.5px; line-height:1.6; color:#a9b8d6; max-width:120mm; margin:0; }
.cover-bottom{
  padding:12mm 18mm 16mm 18mm;
  border-top:1px solid rgba(255,255,255,0.12);
  display:flex; justify-content:space-between; align-items:flex-end;
  font-size:10.5px; color:#8296bd;
}
.cover-bottom strong{ color:#e6edfb; font-weight:700; }
.cover-tags{ display:flex; gap:8px; flex-wrap:wrap; max-width:70mm; justify-content:flex-end; }
.cover-tags span{
  border:1px solid rgba(255,255,255,0.16); border-radius:999px; padding:4px 10px; font-size:9.5px; font-weight:600; color:#cfe0ff;
}

/* ---------- TOC ---------- */
.toc-title{ font-size:26px; font-weight:700; margin:0 0 3mm 0; }
.toc-sub{ font-size:12.5px; color:var(--muted); margin:0 0 12mm 0; }
.toc-list{ display:flex; flex-direction:column; gap:0; }
.toc-item{
  display:flex; align-items:center; gap:5mm; padding:5mm 0; border-bottom:1px solid var(--line);
}
.toc-num{
  width:9mm; height:9mm; border-radius:9px; flex-shrink:0;
  background:var(--brand-grad); color:#fff; font-weight:700; font-size:12.5px;
  display:flex; align-items:center; justify-content:center;
}
.toc-txt{ flex:1; display:flex; flex-direction:column; gap:1mm; }
.toc-txt .t{ font-weight:700; font-size:13.5px; color:var(--ink); }
.toc-txt .d{ font-size:11px; color:var(--muted); }
.toc-pg{ font-size:12px; font-weight:700; color:var(--muted); font-family:'Space Grotesk',sans-serif; }

/* ---------- INNER PAGE HEADER ---------- */
.eyebrow{
  display:inline-flex; align-items:center; gap:7px; font-size:9.5px; font-weight:700;
  letter-spacing:0.14em; text-transform:uppercase; color:#7c3aed; margin-bottom:3mm;
}
.eyebrow .dot{ width:5px; height:5px; border-radius:999px; background:var(--brand-grad); }
.h-title{ font-size:23px; font-weight:700; margin:0 0 3mm 0; color:var(--ink); }
.h-desc{ font-size:12px; line-height:1.65; color:var(--muted); max-width:165mm; margin:0 0 8mm 0; }
.section-mark{
  position:absolute; top:16mm; right:16mm; width:9mm; height:7.2mm; opacity:0.9;
}

/* ---------- CALLOUTS ---------- */
.callout{
  border-radius:12px; padding:4mm 5mm; font-size:11px; line-height:1.6; margin:5mm 0;
  border:1px solid var(--line); display:flex; gap:3mm; align-items:flex-start;
}
.callout .ic{
  width:7mm; height:7mm; border-radius:7px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:800; color:#fff;
}
.callout.tip{ background:#eff6ff; border-color:#bfdbfe; }
.callout.tip .ic{ background:var(--blue); }
.callout.warn{ background:#fffbeb; border-color:#fde68a; }
.callout.warn .ic{ background:var(--amber); }
.callout.ok{ background:#ecfdf5; border-color:#a7f3d0; }
.callout.ok .ic{ background:var(--emerald); }
.callout b{ color:var(--ink); }

/* ---------- NUMBERED STEPS ---------- */
.steps{ display:flex; flex-direction:column; gap:3mm; margin:5mm 0; }
.step{ display:flex; gap:4mm; align-items:flex-start; }
.step-n{
  width:7mm; height:7mm; border-radius:999px; background:var(--brand-grad); color:#fff;
  font-weight:700; font-size:10.5px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  font-family:'Space Grotesk',sans-serif;
}
.step-b{ font-size:11.5px; line-height:1.6; color:#334155; padding-top:0.3mm; }
.step-b b{ color:var(--ink); }
.step-b code{ background:#f1f5f9; border:1px solid var(--line); border-radius:5px; padding:1px 6px; font-size:10.5px; font-family:'Space Grotesk',monospace; color:#4338ca; }

/* ---------- FEATURE GRID ---------- */
.grid2{ display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin:5mm 0; }
.fcard{ border:1px solid var(--line); border-radius:12px; padding:4mm; }
.fcard .ft{ font-weight:700; font-size:11.5px; color:var(--ink); margin-bottom:1.5mm; }
.fcard .fd{ font-size:10.5px; line-height:1.55; color:var(--muted); }

/* ================= MOCKUP FRAME ================= */
.frame{
  border-radius:14px; overflow:hidden; border:1px solid #dbe2ee;
  box-shadow:0 14px 30px rgba(15,23,42,0.10);
  background:#fff;
  margin:6mm 0;
}
.frame-bar{
  height:7mm; background:#eef1f7; border-bottom:1px solid #dbe2ee;
  display:flex; align-items:center; gap:5px; padding:0 3.5mm;
}
.frame-bar .d{ width:2.4mm; height:2.4mm; border-radius:999px; background:#c7cedb; }
.frame-bar .url{
  margin-left:3mm; font-size:8px; color:#94a3b8; background:#fff; border:1px solid #e2e8f0;
  border-radius:999px; padding:1.2mm 4mm; font-family:'Space Grotesk',monospace;
}
.frame-body{ display:flex; background:var(--paper); }
.frame-side{
  width:24mm; flex-shrink:0; background:var(--navy-900); padding:4mm 2.5mm; display:flex; flex-direction:column; gap:1.6mm;
}
.frame-side .logo{ display:flex; align-items:center; gap:1.5mm; padding:0 1mm 3mm 1mm; }
.frame-side .logo img{ width:5mm; height:4mm; }
.frame-side .logo span{ font-size:7.5px; font-weight:700; color:#fff; font-family:'Space Grotesk',sans-serif;}
.nav-i{ display:flex; align-items:center; gap:2mm; padding:1.8mm 2mm; border-radius:6px; font-size:7.6px; font-weight:600; color:#94a3b8; }
.nav-i .b{ width:3mm; height:3mm; border-radius:3px; background:#1e293b; flex-shrink:0; }
.nav-i.on{ background:rgba(255,255,255,0.08); color:#fff; }
.nav-i.on .b{ background:var(--brand-grad); }
.frame-main{ flex:1; min-width:0; }
.frame-top{
  height:8mm; background:#fff; border-bottom:1px solid #e7ebf3; display:flex; align-items:center; gap:2mm; padding:0 4mm;
}
.frame-top .search{ flex:1; max-width:55mm; height:4.6mm; border-radius:5px; background:#f1f4f9; border:1px solid #e5e9f2; }
.frame-top .ic{ width:4.6mm; height:4.6mm; border-radius:5px; background:#f1f4f9; border:1px solid #e5e9f2; }
.frame-content{ padding:4.5mm 5mm; }

/* mockup micro-components */
.mk-h{ display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:3.5mm; }
.mk-h .t{ display:block; font-size:11px; font-weight:700; color:#0f172a; font-family:'Space Grotesk',sans-serif; }
.mk-h .s{ display:block; font-size:7px; color:#94a3b8; margin-top:0.6mm; }
.mk-btn{ font-size:7px; font-weight:800; color:#fff; background:var(--brand-grad); border-radius:5px; padding:1.8mm 3mm; }
.mk-btn.ghost{ background:#fff; color:#7c3aed; border:1px solid #ddd6fe; }
.mk-kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:2mm; margin-bottom:3.5mm; }
.mk-kpi{ background:#fff; border:1px solid #e7ebf3; border-radius:7px; padding:2.2mm; }
.mk-kpi .l{ font-size:6px; color:#94a3b8; font-weight:700; }
.mk-kpi .v{ font-size:11px; font-weight:700; color:#0f172a; margin-top:0.8mm; font-family:'Space Grotesk',sans-serif; }
.mk-chips{ display:flex; gap:1.5mm; margin-bottom:3mm; }
.mk-chip{ font-size:6.4px; font-weight:700; color:#475569; background:#fff; border:1px solid #e2e8f0; border-radius:999px; padding:1.2mm 2.6mm; }
.mk-chip.on{ background:var(--brand-grad); color:#fff; border-color:transparent; }
.mk-table{ background:#fff; border:1px solid #e7ebf3; border-radius:8px; overflow:hidden; }
.mk-row{ display:flex; align-items:center; gap:2mm; padding:2.2mm 3mm; border-bottom:1px solid #eef1f7; font-size:7px; }
.mk-row:last-child{ border-bottom:0; }
.mk-row.h{ background:#f8fafc; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; font-size:6px; }
.mk-row .c1{ width:16mm; font-weight:700; color:#0f172a; }
.mk-row .c2{ flex:1; color:#475569; }
.mk-row .cbadge{ font-size:6px; font-weight:800; border-radius:999px; padding:0.8mm 2.4mm; }
.bd-slate{ background:rgba(100,116,139,0.14); color:#475569; }
.bd-blue{ background:rgba(59,130,246,0.14); color:#2563eb; }
.bd-violet{ background:rgba(139,92,246,0.14); color:#7c3aed; }
.bd-green{ background:rgba(16,185,129,0.14); color:#059669; }
.bd-red{ background:rgba(239,68,68,0.14); color:#dc2626; }
.bd-amber{ background:rgba(245,158,11,0.14); color:#b45309; }
.mk-cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:2.2mm; }
.mk-card{ background:#fff; border:1px solid #e7ebf3; border-radius:8px; padding:2.4mm; }
.mk-card .top{ display:flex; align-items:center; gap:1.8mm; margin-bottom:1.6mm; }
.mk-card .sw{ width:5mm; height:5mm; border-radius:5px; background:var(--brand-grad); flex-shrink:0; }
.mk-card .nm{ display:block; font-size:6.6px; font-weight:700; color:#0f172a; }
.mk-card .sk{ display:block; font-size:5.6px; color:#94a3b8; }
.mk-card .bar{ height:1.6mm; border-radius:999px; background:#eef1f7; overflow:hidden; margin-top:1.4mm; }
.mk-card .bar i{ display:block; height:100%; background:var(--brand-grad); }
.mk-card .qv{ font-size:9px; font-weight:800; color:#0f172a; font-family:'Space Grotesk',sans-serif; }
.mk-drawer{ position:absolute; top:8mm; right:0; bottom:0; width:52mm; background:#fff; border-left:1px solid #e2e8f0; box-shadow:-8px 0 20px rgba(15,23,42,0.08); padding:3.5mm; }
.mk-drawer .dt{ font-size:8.5px; font-weight:800; color:#0f172a; font-family:'Space Grotesk',sans-serif; }
.mk-drawer .ds{ font-size:6.4px; color:#94a3b8; margin:0.8mm 0 3mm 0; }
.mk-field{ margin-bottom:2.4mm; }
.mk-field label{ font-size:6px; font-weight:700; color:#94a3b8; }
.mk-field .box{ margin-top:0.8mm; height:5.5mm; border-radius:5px; background:#f8fafc; border:1px solid #e2e8f0; }
.frame-relative{ position:relative; }

/* status legend */
.legend{ display:flex; flex-wrap:wrap; gap:3mm; margin:4mm 0 6mm 0; }
.legend .li{ display:flex; align-items:center; gap:1.6mm; font-size:10px; color:#334155; }
.legend .sw{ width:3mm; height:3mm; border-radius:999px; }

/* footer note strip on inner pages */
.foot-strip{
  position:absolute; left:16mm; right:16mm; bottom:10mm; padding-top:3mm; border-top:1px solid var(--line);
  display:flex; justify-content:space-between; font-size:8.5px; color:#94a3b8;
}
.foot-strip b{ color:#475569; }

/* FAQ */
.faq{ display:flex; flex-direction:column; gap:3.5mm; margin-top:4mm; }
.faq-item{ border:1px solid var(--line); border-radius:12px; padding:4mm 4.5mm; }
.faq-q{ font-weight:700; font-size:11.5px; color:var(--ink); display:flex; gap:2.5mm; }
.faq-q .qm{ width:5.5mm; height:5.5mm; flex-shrink:0; border-radius:6px; background:var(--brand-grad); color:#fff; font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; }
.faq-a{ font-size:10.5px; line-height:1.6; color:#475569; margin:2mm 0 0 8mm; }

/* end page */
.end{
  background:linear-gradient(180deg,var(--navy-950) 0%, var(--navy-900) 100%);
  color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:0 20mm;
}
.end img{ width:20mm; margin-bottom:8mm; }
.end h2{ font-size:22px; margin:0 0 4mm 0; }
.end p{ font-size:12px; color:#a9b8d6; line-height:1.7; max-width:120mm; }
.end .cta{ margin-top:9mm; display:inline-flex; gap:2mm; align-items:center; background:var(--brand-grad); color:#fff; font-weight:700; font-size:11px; padding:3.4mm 7mm; border-radius:999px; }
`;

function frameSidebar(activeIndex, urlLabel){
  const items = [
    ["Início"], ["Meus pedidos"], ["Recebimento"], ["Meus produtos"], ["Faturas"], ["Suporte"],
  ];
  return `
  <div class="frame">
    <div class="frame-bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="url">portal.infinoos.com.br/portal${urlLabel ? "?view=" + urlLabel : ""}</span></div>
    <div class="frame-body frame-relative">
      <aside class="frame-side">
        <div class="logo"><img src="${iconDataUri}"/><span>INFINOOS</span></div>
        ${items.map((it, i) => `<div class="nav-i ${i===activeIndex?"on":""}"><span class="b"></span>${it[0]}</div>`).join("")}
      </aside>
      <div class="frame-main">
        <div class="frame-top"><span class="search"></span><span style="flex:1"></span><span class="ic"></span><span class="ic"></span></div>
        <div class="frame-content">
          __SLOT__
        </div>
      </div>
    </div>
  </div>`;
}

function page(inner, extraClass=""){
  return `<section class="page ${extraClass}">${inner}</section>`;
}

function footStrip(section){
  return `<div class="foot-strip"><span><b>Manual do Portal do Depositante</b> · Infinoos WMS</span><span>${section}</span></div>`;
}

// ---------------------------------------------------------------- COVER
const cover = page(`
  <div class="cover">
    <div class="cover-top">
      <img class="cover-mark" src="${iconDataUri}"/>
      <img class="cover-wordmark" src="${lockupDataUri}"/>
    </div>
    <div class="cover-mid">
      <span class="cover-eyebrow"><span class="dot"></span>PORTAL DO DEPOSITANTE</span>
      <h1 class="cover-title">Manual do <span class="grad">Portal do<br/>Depositante</span></h1>
      <p class="cover-sub">Guia completo para acompanhar pedidos, recebimentos e estoque no CD Infinoos — direto do seu navegador, sem depender de e-mail ou WhatsApp para saber o status da sua operação.</p>
    </div>
    <div class="cover-bottom">
      <div><strong>Infinoos WMS</strong><br/>Manual de uso · Edição 2026.08</div>
      <div class="cover-tags"><span>Pedidos</span><span>Recebimento</span><span>Estoque</span><span>Suporte</span></div>
    </div>
  </div>
`, "cover");

// ---------------------------------------------------------------- TOC
const tocItems = [
  ["01", "Bem-vindo ao portal", "O que é, para quem é e o que você consegue fazer sozinho"],
  ["02", "Primeiro acesso e login", "Como entrar e criar sua senha pessoal"],
  ["03", "Navegando pelo portal", "Menu lateral, busca, notificações e tema claro/escuro"],
  ["04", "Início", "Visão geral da sua operação em um só lugar"],
  ["05", "Meus pedidos", "Enviar pedidos ao CD, importar XML e acompanhar a separação"],
  ["06", "Recebimento", "Agendar entradas de mercadoria e acompanhar a conferência"],
  ["07", "Meus produtos", "Saldo em estoque e limites de reposição"],
  ["08", "Faturas", "Status atual desta área"],
  ["09", "Suporte", "Abrir chamados e falar com a equipe Infinoos"],
  ["10", "Perguntas frequentes", "Respostas rápidas para as dúvidas mais comuns"],
];
const toc = page(`
  <span class="eyebrow"><span class="dot"></span>SUMÁRIO</span>
  <h1 class="toc-title">O que você vai encontrar aqui</h1>
  <p class="toc-sub">Este manual acompanha exatamente as telas do portal, na ordem em que elas aparecem no menu lateral.</p>
  <div class="toc-list">
    ${tocItems.map(([n,t,d]) => `
      <div class="toc-item">
        <span class="toc-num">${n}</span>
        <span class="toc-txt"><span class="t">${t}</span><span class="d">${d}</span></span>
      </div>`).join("")}
  </div>
`);

// ---------------------------------------------------------------- 01 WELCOME
const s01 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 01</span>
  <h1 class="h-title">Bem-vindo ao portal do depositante</h1>
  <p class="h-desc">O portal é o canal oficial da sua empresa com o CD Infinoos. Por aqui, sua equipe acompanha em tempo real tudo o que acontece com a sua carga armazenada — sem precisar telefonar ou trocar e-mails para saber um status.</p>

  <div class="grid2">
    <div class="fcard"><div class="ft">📦 Envie pedidos direto ao CD</div><div class="fd">Cadastre manualmente ou importe a XML da NF-e — o pedido cai automaticamente na fila de separação da Infinoos.</div></div>
    <div class="fcard"><div class="ft">🚚 Agende recebimentos</div><div class="fd">Avise a chegada de mercadoria com antecedência, informando fornecedor, data, horário e itens esperados.</div></div>
    <div class="fcard"><div class="ft">📊 Acompanhe seu estoque</div><div class="fd">Veja o saldo real de cada produto no CD e configure limites mínimo/máximo para saber quando repor.</div></div>
    <div class="fcard"><div class="ft">💬 Fale com a Infinoos</div><div class="fd">Abra chamados de suporte direto pelo portal, com histórico e resposta em até 2h úteis.</div></div>
  </div>

  <div class="callout tip">
    <span class="ic">i</span>
    <div><b>Para quem é este manual:</b> qualquer pessoa da sua empresa com acesso ao portal — não é necessário conhecimento técnico. Cada seção deste guia corresponde a um item do menu lateral do portal.</div>
  </div>

  <div class="callout warn">
    <span class="ic">!</span>
    <div><b>O que o portal não faz:</b> ele não substitui a separação e conferência física, que continuam sendo feitas pela equipe operacional da Infinoos dentro do CD. O portal é a sua janela para acompanhar esse trabalho.</div>
  </div>
  ${footStrip("Capítulo 01 · Bem-vindo")}
`);

// ---------------------------------------------------------------- 02 LOGIN
const s02 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 02</span>
  <h1 class="h-title">Primeiro acesso e login</h1>
  <p class="h-desc">O acesso é individual: cada pessoa da sua equipe deve ter seu próprio usuário. Se você ainda não tem um, peça para a Infinoos criar o seu através do suporte.</p>

  <div class="steps">
    <div class="step"><span class="step-n">1</span><div class="step-b">Acesse o endereço do portal informado pela Infinoos e informe seu <b>usuário ou e-mail corporativo</b> e sua <b>senha</b> na tela <b>"Bem-vindo de volta"</b>.</div></div>
    <div class="step"><span class="step-n">2</span><div class="step-b">Esqueceu a senha? Use o link <b>"Esqueci minha senha"</b> logo abaixo do campo de senha.</div></div>
    <div class="step"><span class="step-n">3</span><div class="step-b">Clique em <b>"Entrar na operação"</b> para acessar.</div></div>
    <div class="step"><span class="step-n">4</span><div class="step-b">No <b>primeiro login</b>, o sistema abre automaticamente a tela <b>"Primeiro acesso"</b> pedindo para você definir uma <b>senha pessoal</b> — esse passo é obrigatório e não pode ser pulado.</div></div>
    <div class="step"><span class="step-n">5</span><div class="step-b">Preencha <b>"Nova senha"</b> e <b>"Confirmar nova senha"</b> (mínimo de <b>8 caracteres</b>, e os dois campos precisam ser idênticos) e clique em <b>"Salvar nova senha"</b>. O portal libera o restante da navegação automaticamente.</div></div>
  </div>

  <div class="callout ok">
    <span class="ic">✓</span>
    <div><b>Dica de segurança:</b> não compartilhe seu login com colegas. Se mais pessoas da sua empresa precisam de acesso, peça um usuário para cada uma — assim é possível saber quem fez o quê dentro do portal.</div>
  </div>
  ${footStrip("Capítulo 02 · Login")}
`);

// ---------------------------------------------------------------- 03 NAV
const s03mock = frameSidebar(0, "").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Olá, Ana 👋</div><div class="s">Acompanhe seu estoque no CD Infinoos e envie novos pedidos para expedição.</div></div></div>
  <div class="mk-kpis">
    <div class="mk-kpi"><div class="l">TAREFAS HOJE</div><div class="v">3</div></div>
    <div class="mk-kpi"><div class="l">PEDIDOS P/ SEPARAR</div><div class="v">12</div></div>
    <div class="mk-kpi"><div class="l">DIVERGÊNCIAS</div><div class="v">0</div></div>
    <div class="mk-kpi"><div class="l">RECEBIMENTOS</div><div class="v">2</div></div>
  </div>
`);
const s03 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 03</span>
  <h1 class="h-title">Navegando pelo portal</h1>
  <p class="h-desc">A estrutura é a mesma em todas as telas: um menu lateral fixo à esquerda e uma barra superior com busca, notificações e tema.</p>
  ${s03mock}
  <div class="grid2">
    <div class="fcard"><div class="ft">Menu lateral</div><div class="fd">Seis áreas: <b>Início, Meus pedidos, Recebimento, Meus produtos, Faturas</b> e <b>Suporte</b>. A área ativa fica destacada.</div></div>
    <div class="fcard"><div class="ft">Busca no topo</div><div class="fd">O campo de busca se adapta à tela: filtra pedidos por número/cliente/canal, ou produtos por nome/SKU quando você está em "Meus produtos".</div></div>
    <div class="fcard"><div class="ft">Notificações</div><div class="fd">O sino no canto superior direito centraliza avisos importantes sobre sua operação.</div></div>
    <div class="fcard"><div class="ft">Tema claro/escuro</div><div class="fd">O botão ao lado do sino alterna entre os dois modos — sua preferência fica salva no navegador.</div></div>
  </div>
  ${footStrip("Capítulo 03 · Navegação")}
`);

// ---------------------------------------------------------------- 04 HOME
const s04mock = frameSidebar(0, "").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Olá, Ana 👋</div><div class="s">Acompanhe seu estoque no CD Infinoos e envie novos pedidos para expedição.</div></div></div>
  <div class="mk-kpis">
    <div class="mk-kpi"><div class="l">PEDIDOS EM OPERAÇÃO</div><div class="v">18</div></div>
    <div class="mk-kpi"><div class="l">PRODUTOS NO CD</div><div class="v">96</div></div>
    <div class="mk-kpi"><div class="l">RECEBIMENTOS</div><div class="v">3</div></div>
    <div class="mk-kpi"><div class="l">UNIDADES EM ESTOQUE</div><div class="v">4.180</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:3mm;">
    <div class="mk-table">
      <div class="mk-row h"><span class="c1">PEDIDOS RECENTES</span></div>
      <div class="mk-row"><span class="c1">#10432</span><span class="c2">Loja Aurora · Mercado Livre</span><span class="cbadge bd-blue">Em separação</span></div>
      <div class="mk-row"><span class="c1">#10431</span><span class="c2">Marina Costa · Site próprio</span><span class="cbadge bd-green">Expedido</span></div>
      <div class="mk-row"><span class="c1">#10430</span><span class="c2">Loja Aurora · Shopee</span><span class="cbadge bd-slate">Recebido</span></div>
    </div>
    <div class="mk-table">
      <div class="mk-row h"><span class="c1">ESTOQUE BAIXO</span></div>
      <div class="mk-row"><span class="c2">Vela 7 Dias 265g</span><span class="cbadge bd-amber">4</span></div>
      <div class="mk-row"><span class="c2">Vinho Branco Toscana</span><span class="cbadge bd-amber">2</span></div>
    </div>
  </div>
`);
const s04 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 04</span>
  <h1 class="h-title">Início — visão geral da operação</h1>
  <p class="h-desc">É a primeira tela ao entrar. Reúne, num só lugar, o essencial do que está acontecendo com a sua carga agora.</p>
  ${s04mock}
  <div class="grid2">
    <div class="fcard"><div class="ft">Indicadores no topo</div><div class="fd"><b>Pedidos em operação</b>, <b>Produtos no CD</b>, <b>Recebimentos</b> e <b>Unidades em estoque</b> — sempre atualizados.</div></div>
    <div class="fcard"><div class="ft">Pedidos recentes</div><div class="fd">Os 6 pedidos mais recentes, com atalho <b>"Ver todos"</b> para a tela completa de "Meus pedidos".</div></div>
    <div class="fcard"><div class="ft">Níveis de estoque</div><div class="fd">Lista os produtos com saldo igual ou abaixo de 5 unidades — seu radar rápido de reposição.</div></div>
    <div class="fcard"><div class="ft">Saudação personalizada</div><div class="fd">O cumprimento muda de acordo com o horário do dia e mostra seu nome de usuário.</div></div>
  </div>
  ${footStrip("Capítulo 04 · Início")}
`);

// ---------------------------------------------------------------- 05 ORDERS
const s05mock = frameSidebar(1, "pedidos").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Meus pedidos</div><div class="s">Pedidos enviados ao CD para separação e expedição.</div></div><div style="display:flex;gap:1.5mm;"><span class="mk-btn ghost">Importar XML</span><span class="mk-btn">+ Novo pedido</span></div></div>
  <div class="mk-chips"><span class="mk-chip on">Todos 18</span><span class="mk-chip">Recebido 4</span><span class="mk-chip">Em separação 6</span><span class="mk-chip">Expedido 7</span><span class="mk-chip">Cancelado 1</span></div>
  <div class="mk-table">
    <div class="mk-row h"><span class="c1">PEDIDO</span><span class="c2">CLIENTE / CANAL</span><span style="width:16mm">STATUS</span></div>
    <div class="mk-row"><span class="c1">#10432</span><span class="c2">Loja Aurora · Mercado Livre</span><span class="cbadge bd-blue">Em separação</span></div>
    <div class="mk-row"><span class="c1">#10431</span><span class="c2">Marina Costa · Site próprio</span><span class="cbadge bd-green">Expedido</span></div>
    <div class="mk-row"><span class="c1">#10430</span><span class="c2">Loja Aurora · Shopee</span><span class="cbadge bd-slate">Recebido</span></div>
    <div class="mk-row"><span class="c1">#10429</span><span class="c2">João Pereira · Amazon</span><span class="cbadge bd-red">Cancelado</span></div>
  </div>
`);
const s05 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 05</span>
  <h1 class="h-title">Meus pedidos</h1>
  <p class="h-desc">Aqui você envia novos pedidos de venda para o CD separar e expedir, e acompanha cada um até a entrega ao transportador.</p>
  ${s05mock}
  <div class="legend">
    <span class="li"><span class="sw" style="background:#64748B"></span>Recebido — chegou no CD, aguardando separação</span>
    <span class="li"><span class="sw" style="background:#3B82F6"></span>Em separação — sendo separado/conferido</span>
    <span class="li"><span class="sw" style="background:#10B981"></span>Expedido — já saiu para entrega</span>
    <span class="li"><span class="sw" style="background:#EF4444"></span>Cancelado</span>
  </div>
  <p style="font-size:11px;color:#475569;line-height:1.6;margin:0 0 3mm 0;">Use os filtros para ver só um status, clique nos cabeçalhos da tabela para ordenar, e a busca no topo para encontrar por número do pedido, cliente ou canal.</p>
  ${footStrip("Capítulo 05 · Meus pedidos (1/3)")}
`);

const s05bmock = frameSidebar(1, "pedidos").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Meus pedidos</div></div></div>
  <div class="mk-drawer">
    <div class="dt">NOVO PEDIDO</div>
    <div class="ds">Enviar pedido ao CD</div>
    <div class="mk-field"><label>CANAL DE VENDA</label><div class="box"></div></div>
    <div class="mk-field"><label>NÚMERO DO PEDIDO</label><div class="box"></div></div>
    <div class="mk-field"><label>NOME DO CLIENTE</label><div class="box"></div></div>
    <div class="mk-field"><label>ENDEREÇO / CEP</label><div class="box"></div></div>
    <div class="mk-field"><label>ITENS DO PEDIDO</label><div class="box" style="height:11mm"></div></div>
    <div class="mk-field"><label>TRANSPORTADORA</label><div class="box"></div></div>
    <span class="mk-btn" style="display:block;text-align:center;margin-top:2mm;">Enviar ao CD</span>
  </div>
`);
const s05b = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 05</span>
  <h1 class="h-title">Como enviar um pedido — modo manual</h1>
  <p class="h-desc">Clique em <b>"+ Novo pedido"</b> para abrir o formulário e cadastrar um pedido item a item.</p>
  ${s05bmock}
  <div class="steps">
    <div class="step"><span class="step-n">1</span><div class="step-b">Escolha o <b>"Canal de venda"</b> (Mercado Livre, Shopee, Amazon, Magalu, Shein, TikTok, Kwai, Site próprio ou Venda direta).</div></div>
    <div class="step"><span class="step-n">2</span><div class="step-b">Informe o <b>"Número do pedido"</b> e os dados do <b>destinatário</b>: nome do cliente (obrigatório), CPF/CNPJ, CEP, cidade/UF, endereço, número e telefone.</div></div>
    <div class="step"><span class="step-n">3</span><div class="step-b">Em <b>"Itens do pedido"</b>, clique em <b>"+ Adicionar item"</b>, busque o produto e ajuste a quantidade com os botões <code>−</code> / <code>+</code>.</div></div>
    <div class="step"><span class="step-n">4</span><div class="step-b">Informe a <b>transportadora</b> e clique em <b>"Enviar ao CD"</b>. O pedido entra imediatamente na fila de separação.</div></div>
  </div>
  <div class="callout tip"><span class="ic">i</span><div><b>Mais rápido:</b> se você já tem a XML da nota fiscal, use o botão <b>"Importar XML"</b> em vez do formulário manual — o sistema reconhece os produtos automaticamente pelo código de barras (EAN), código interno ou nome, e preenche o pedido sozinho. Basta conferir a transportadora e confirmar.</div></div>
  ${footStrip("Capítulo 05 · Meus pedidos (2/3)")}
`);

const s05cmock = frameSidebar(1, "pedidos").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Meus pedidos</div></div></div>
  <div class="mk-drawer" style="width:56mm;">
    <div class="dt">PEDIDO #10432</div>
    <div class="ds" style="display:inline-flex;background:rgba(59,130,246,.14);color:#2563eb;border-radius:999px;padding:0.8mm 2.6mm;font-weight:800;">Em separação</div>
    <div style="display:flex;gap:2.4mm;margin:3mm 0;">
      <div class="mk-card" style="flex:1;text-align:center;"><div class="qv">62%</div><div class="sk">progresso</div></div>
      <div class="mk-card" style="flex:1;"><div class="sk">Cliente</div><div class="nm">Loja Aurora</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.6mm;margin-bottom:3mm;">
      <div class="mk-card" style="text-align:center;"><div class="sk">Nota fiscal</div></div>
      <div class="mk-card" style="text-align:center;"><div class="sk">DANFE</div></div>
      <div class="mk-card" style="text-align:center;"><div class="sk">Etiqueta</div></div>
    </div>
    <div class="mk-field"><label>ITENS DO PEDIDO</label><div class="box" style="height:14mm"></div></div>
  </div>
`);
const s05c = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 05</span>
  <h1 class="h-title">Acompanhando o detalhe de um pedido</h1>
  <p class="h-desc">Clique em qualquer linha da tabela para abrir o painel de detalhes.</p>
  ${s05cmock}
  <div class="grid2">
    <div class="fcard"><div class="ft">Progresso circular</div><div class="fd">Mostra o percentual já separado/conferido em relação ao total de unidades do pedido.</div></div>
    <div class="fcard"><div class="ft">Documentos</div><div class="fd"><b>Nota fiscal</b>, <b>DANFE simplificada</b> e <b>Etiqueta de envio</b> — visualize, baixe ou anexe quando estiverem disponíveis.</div></div>
    <div class="fcard"><div class="ft">Dados operacionais</div><div class="fd">Canal, depositante, nota fiscal, data de criação, data prevista e transportadora, tudo em um resumo.</div></div>
    <div class="fcard"><div class="ft">Itens do pedido</div><div class="fd">Cada item mostra um ✓ verde assim que a quantidade solicitada foi totalmente separada.</div></div>
  </div>
  <div class="callout warn"><span class="ic">!</span><div><b>Mensagens ao enviar um pedido:</b> se aparecer um aviso ao importar XML, confira o motivo — <b>"Anexe o XML da nota fiscal antes de enviar"</b>, <b>"XML inválida ou sem o número da nota"</b>, ou <b>"Já existe um pedido com essa mesma NF-e"</b> (nota já usada antes). Corrija o arquivo ou os dados e tente novamente.</div></div>
  ${footStrip("Capítulo 05 · Meus pedidos (3/3)")}
`);

// ---------------------------------------------------------------- 06 RECEIVING
const s06mock = frameSidebar(2, "recebimento").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Recebimento</div><div class="s">Agende entradas de mercadoria e acompanhe o recebimento no CD.</div></div><span class="mk-btn">+ Nova solicitação</span></div>
  <div class="mk-kpis">
    <div class="mk-kpi"><div class="l">AGENDADOS</div><div class="v">3</div></div>
    <div class="mk-kpi"><div class="l">EM RECEBIMENTO</div><div class="v">1</div></div>
    <div class="mk-kpi"><div class="l">CONFERIDOS</div><div class="v">12</div></div>
    <div class="mk-kpi"><div class="l">DIVERGÊNCIAS</div><div class="v">0</div></div>
  </div>
  <div class="mk-table">
    <div class="mk-row h"><span class="c1">SOLICITAÇÃO</span><span class="c2">TRANSPORTADORA / NF-e</span><span style="width:16mm">STATUS</span></div>
    <div class="mk-row"><span class="c1">RC-0891</span><span class="c2">Total Express · NF-e 8899</span><span class="cbadge bd-violet">Agendado</span></div>
    <div class="mk-row"><span class="c1">RC-0890</span><span class="c2">Jamef · NF-e 8850</span><span class="cbadge bd-blue">Em recebimento</span></div>
    <div class="mk-row"><span class="c1">RC-0889</span><span class="c2">Braspress · NF-e 8801</span><span class="cbadge bd-green">Conferido</span></div>
  </div>
`);
const s06 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 06</span>
  <h1 class="h-title">Recebimento</h1>
  <p class="h-desc">Use esta tela para avisar a Infinoos que uma mercadoria sua está a caminho do CD, e para acompanhar a conferência assim que ela chega.</p>
  ${s06mock}
  <p style="font-size:11px;color:#475569;line-height:1.6;margin:0 0 2mm 0;"><b>Clique em "+ Nova solicitação"</b> e escolha um dos três formatos:</p>
  <div class="grid2">
    <div class="fcard"><div class="ft">📄 NF-e XML</div><div class="fd">Anexe o arquivo XML da nota — fornecedor e itens são preenchidos automaticamente pelo sistema.</div></div>
    <div class="fcard"><div class="ft">✍️ Manual</div><div class="fd">Informe transportadora, nº da NF-e, data e horário previstos, e adicione os itens esperados um a um.</div></div>
    <div class="fcard"><div class="ft">🔁 Transferência</div><div class="fd">Mesmo formulário do manual, usado quando a mercadoria vem de outro depósito seu, sem nota de venda.</div></div>
    <div class="fcard"><div class="ft">📝 Observações</div><div class="fd">Campo livre disponível nos formulários Manual e Transferência para instruções extras à equipe do CD.</div></div>
  </div>
  <div class="callout tip"><span class="ic">i</span><div>Depois de enviada, a solicitação some do formulário e passa a aparecer na tabela com status <b>"Agendado"</b>. Clique nela a qualquer momento para ver o progresso item a item (recebido × esperado).</div></div>
  <div class="callout warn"><span class="ic">!</span><div><b>Cancelamento:</b> o botão <b>"Cancelar solicitação"</b> só existe enquanto o status ainda é <b>"Agendado"</b> e nada foi recebido. Depois que a conferência começa, a solicitação não pode mais ser cancelada pelo portal — fale com o <b>Suporte</b>.</div></div>
  ${footStrip("Capítulo 06 · Recebimento")}
`);

// ---------------------------------------------------------------- 07 PRODUCTS
const s07mock = frameSidebar(3, "produtos").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Meus produtos no CD</div><div class="s">Saldo em estoque armazenado no CD Infinoos.</div></div></div>
  <div class="mk-cards">
    <div class="mk-card"><div class="top"><span class="sw"></span><div><div class="nm">Vela 7 Dias 265g</div><div class="sk">VELA001</div></div></div><div class="qv">42</div><div class="sk">disponível</div><div class="bar"><i style="width:60%"></i></div></div>
    <div class="mk-card"><div class="top"><span class="sw"></span><div><div class="nm">Vinho Branco Toscana</div><div class="sk">BE0030</div></div></div><div class="qv">4</div><div class="sk">disponível</div><div class="bar"><i style="width:12%"></i></div></div>
    <div class="mk-card"><div class="top"><span class="sw"></span><div><div class="nm">Água Micelar 200ml</div><div class="sk">CO0028</div></div></div><div class="qv">0</div><div class="sk">disponível</div><div class="bar"><i style="width:2%"></i></div></div>
  </div>
`);
const s07 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 07</span>
  <h1 class="h-title">Meus produtos</h1>
  <p class="h-desc">Mostra o saldo real de cada um dos seus produtos armazenados no CD, atualizado a cada movimentação.</p>
  ${s07mock}
  <div class="grid2">
    <div class="fcard"><div class="ft">Busca "Filtrar produtos..."</div><div class="fd">Filtra por nome ou SKU em tempo real, sem precisar apertar Enter.</div></div>
    <div class="fcard"><div class="ft">Cada cartão mostra</div><div class="fd">Foto, nome, SKU, quantidade disponível e uma barra indicando a posição entre o mínimo e o máximo configurados.</div></div>
    <div class="fcard"><div class="ft">Selos de status</div><div class="fd"><b>Monitorado</b> (verde), <b>Atenção</b> (âmbar, no ou abaixo do mínimo) e <b>Sem estoque</b> (vermelho, saldo zerado).</div></div>
    <div class="fcard"><div class="ft">Configurar estoque</div><div class="fd">O ícone de engrenagem abre um painel para você mesmo definir o <b>"Estoque mínimo"</b> e o <b>"Estoque máximo"</b> de cada produto.</div></div>
  </div>
  <div class="callout tip"><span class="ic">i</span><div><b>Para que serve o mínimo e o máximo:</b> abaixo do mínimo, o produto entra em alerta de reposição; acima do máximo, o sistema avisa que o estoque está acima do planejado. Ajuste esses dois números para que os selos reflitam a realidade do seu negócio.</div></div>
  ${footStrip("Capítulo 07 · Meus produtos")}
`);

// ---------------------------------------------------------------- 08 INVOICES
const s08 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 08</span>
  <h1 class="h-title">Faturas</h1>
  <p class="h-desc">Esta área vai reunir os custos de armazenagem, manuseio e expedição do período.</p>
  <div class="frame">
    <div class="frame-bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="url">portal.infinoos.com.br/portal?view=faturas</span></div>
    <div class="frame-body">
      <aside class="frame-side">
        <div class="logo"><img src="${iconDataUri}"/><span>INFINOOS</span></div>
        ${["Início","Meus pedidos","Recebimento","Meus produtos","Faturas","Suporte"].map((l,i)=>`<div class="nav-i ${i===4?"on":""}"><span class="b"></span>${l}</div>`).join("")}
      </aside>
      <div class="frame-main">
        <div class="frame-top"><span class="search"></span><span style="flex:1"></span><span class="ic"></span><span class="ic"></span></div>
        <div class="frame-content" style="display:flex;align-items:center;justify-content:center;padding:16mm 5mm;">
          <div style="text-align:center;">
            <div style="width:14mm;height:14mm;border-radius:10px;background:rgba(139,92,246,0.12);color:#7c3aed;display:flex;align-items:center;justify-content:center;margin:0 auto 3mm auto;font-size:14px;">🛠</div>
            <div style="font-size:7px;font-weight:800;color:#b45309;background:rgba(245,158,11,0.12);display:inline-block;border-radius:999px;padding:0.8mm 3mm;margin-bottom:2mm;">EM DESENVOLVIMENTO</div>
            <div class="mk-h" style="justify-content:center;"><div class="t">Faturas em breve</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="callout warn"><span class="ic">!</span><div><b>Situação atual:</b> a área de Faturas ainda está em construção e por enquanto não mostra dados. Até que ela seja liberada, qualquer dúvida sobre custos de armazenagem, manuseio ou expedição deve ser tratada pelo <b>Suporte</b> (categoria <b>"Financeiro"</b>).</div></div>
  ${footStrip("Capítulo 08 · Faturas")}
`);

// ---------------------------------------------------------------- 09 SUPPORT
const s09mock = frameSidebar(5, "suporte").replace("__SLOT__", `
  <div class="mk-h"><div><div class="t">Suporte</div><div class="s">Abra um chamado ou acompanhe as solicitações com a equipe Infinoos.</div></div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;">
    <div class="mk-drawer" style="position:static;width:auto;border-left:1px solid #e7ebf3;border-radius:8px;">
      <div class="dt">ABRIR CHAMADO</div>
      <div class="mk-field"><label>ASSUNTO</label><div class="box"></div></div>
      <div class="mk-field"><label>CATEGORIA</label><div style="display:flex;gap:1.2mm;margin-top:0.8mm;"><span class="mk-chip on">Divergência</span><span class="mk-chip">Estoque</span></div></div>
      <div class="mk-field"><label>MENSAGEM</label><div class="box" style="height:10mm"></div></div>
      <span class="mk-btn" style="display:block;text-align:center;">Enviar chamado</span>
    </div>
    <div class="mk-table">
      <div class="mk-row h"><span class="c1">MEUS CHAMADOS</span></div>
      <div class="mk-row"><span class="c2">#221 · Divergência na nota 8899</span><span class="cbadge bd-blue">Aberto</span></div>
      <div class="mk-row"><span class="c2">#218 · Ajuste de estoque</span><span class="cbadge bd-green">Resolvido</span></div>
    </div>
  </div>
`);
const s09 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 09</span>
  <h1 class="h-title">Suporte</h1>
  <p class="h-desc">Canal direto com a equipe Infinoos para dúvidas, divergências ou qualquer imprevisto na sua operação.</p>
  ${s09mock}
  <div class="steps">
    <div class="step"><span class="step-n">1</span><div class="step-b">Preencha <b>"Assunto"</b>, escolha a <b>"Categoria"</b> (<b>Divergência</b>, <b>Estoque</b>, <b>Financeiro</b> ou <b>Outros</b>) e descreva o caso em <b>"Mensagem"</b>.</div></div>
    <div class="step"><span class="step-n">2</span><div class="step-b">Clique em <b>"Enviar chamado"</b>. O tempo de resposta informado no portal é de até <b>2h úteis</b>.</div></div>
    <div class="step"><span class="step-n">3</span><div class="step-b">Acompanhe tudo em <b>"Meus chamados"</b>: cada chamado mostra um selo de status e o número de mensagens novas.</div></div>
    <div class="step"><span class="step-n">4</span><div class="step-b">Clique em um chamado para abrir a conversa e responder no campo <b>"Escreva um comentário..."</b> (Enter também envia).</div></div>
  </div>
  <div class="callout warn"><span class="ic">!</span><div>O chat de suporte ainda não permite anexar arquivos — para enviar comprovantes, fotos ou XML relacionados ao chamado, descreva no texto que você fará o envio por outro canal combinado com a equipe Infinoos.</div></div>
  ${footStrip("Capítulo 09 · Suporte")}
`);

// ---------------------------------------------------------------- 10 FAQ
const faqs = [
  ["Esqueci minha senha, e agora?", "Na tela de login, clique em “Esqueci minha senha” logo abaixo do campo de senha. Se não conseguir recuperar, abra um chamado de Suporte pedindo para redefinir seu acesso."],
  ["Posso ter mais de um usuário da minha empresa no portal?", "Sim, e é o recomendado. Cada pessoa da sua equipe deve ter seu próprio login — peça para a Infinoos criar um usuário adicional pelo Suporte."],
  ["Enviei um pedido errado, dá para editar depois?", "Não existe edição direta pelo portal após o envio. Se a separação ainda não começou, abra um chamado de Suporte o quanto antes pedindo o ajuste ou cancelamento."],
  ["Como sei se meu pedido já foi expedido?", "Acompanhe a coluna “Status” em “Meus pedidos”: o selo verde “Expedido” indica que a carga já saiu do CD para entrega."],
  ["Posso cancelar uma solicitação de recebimento?", "Sim, enquanto ela ainda estiver “Agendada” e nada tiver sido recebido. Abra a solicitação e use o botão “Cancelar solicitação”."],
  ["Um produto meu não aparece em “Meus produtos”, por quê?", "Só aparecem produtos ativos com registro de estoque no CD. Se algo estiver faltando, abra um chamado de Suporte (categoria “Estoque”) para a equipe revisar o cadastro."],
];
const s10 = page(`
  <span class="eyebrow"><span class="dot"></span>CAPÍTULO 10</span>
  <h1 class="h-title">Perguntas frequentes</h1>
  <p class="h-desc">Respostas rápidas para as dúvidas mais comuns de quem está começando a usar o portal.</p>
  <div class="faq">
    ${faqs.map(([q,a]) => `<div class="faq-item"><div class="faq-q"><span class="qm">?</span>${q}</div><div class="faq-a">${a}</div></div>`).join("")}
  </div>
  ${footStrip("Capítulo 10 · Perguntas frequentes")}
`);

// ---------------------------------------------------------------- END
const end = page(`
  <div class="end">
    <img src="${iconDataUri}"/>
    <h2>Pronto para começar</h2>
    <p>Este manual acompanha as telas do portal como elas são hoje. Se algo mudar ou surgir uma dúvida que não está aqui, o canal <b style="color:#fff;">Suporte</b> dentro do próprio portal é sempre o caminho mais rápido para falar com a equipe Infinoos.</p>
    <span class="cta">Infinoos WMS · Portal do Depositante</span>
  </div>
`, "cover");

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Manual do Portal do Depositante</title><style>${CSS}</style></head><body>
${cover}${toc}${s01}${s02}${s03}${s04}${s05}${s05b}${s05c}${s06}${s07}${s08}${s09}${s10}${end}
</body></html>`;

const outHtmlPath = path.join(root, "scratch", "manual", "manual.html");
fs.writeFileSync(outHtmlPath, html, "utf8");
console.log("HTML written:", outHtmlPath, html.length, "bytes");

const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });
const outPdfPath = path.join(outDir, "Manual do Portal do Depositante - Infinoos WMS.pdf");

const browser = await chromium.launch();
const page1 = await browser.newPage();
await page1.goto("file:///" + outHtmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
await page1.pdf({
  path: outPdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "0mm", bottom: "8mm", left: "0mm", right: "0mm" },
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `<div style="width:100%;font-size:8px;color:#94a3b8;text-align:center;font-family:Inter,sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
});
await browser.close();
console.log("PDF written:", outPdfPath);
