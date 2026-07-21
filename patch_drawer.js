const fs = require('fs');

let t = fs.readFileSync('src/components/expedicao/expedicao-client.tsx', 'utf8');

// 1. Add state
t = t.replace(
  'const [currentPage, setCurrentPage] = useState(1);',
  'const [currentPage, setCurrentPage] = useState(1);\n  const [selectedOrder, setSelectedOrder] = useState<any>(null);'
);

// 2. Add rawOrder to mapped orders to be used in the drawer (since o is mapped, we keep all fields)
// I will just use the `o` mapped object which already has carrier, itemsLabel, etc., plus the raw API data.
t = t.replace(
  'carrierBg: cs.bg,',
  'carrierBg: cs.bg,\n      raw: o,'
);

// 3. Add onClick to row
t = t.replace(
  '<tr onClick={o.open} style={{borderBottom:',
  '<tr onClick={() => { setSelectedOrder(o); if(o.open) o.open(); }} style={{borderBottom:'
);

// 4. Drawer UI code
const drawerCode = `
      {/*<!-- ============ DRAWER ============ -->*/}
      {selectedOrder && (() => {
        const sel = selectedOrder;
        
        const getTimelineSteps = (status: string, t: any) => {
          const activeColor = "#3B82F6";
          const successColor = "#10B981";
          const pendingColor = t.barTrack;
          const activeHalo = "rgba(59,130,246,0.15)";
          const successHalo = "rgba(16,185,129,0.15)";
          
          const isConferidoExpedido = ["CONFERIDO", "PRONTO_ROMANEIO", "EXPEDIDO"].includes(status);
          const isConferencia = status === "EM_CONFERENCIA";
          const isSeparacao = ["EM_SEPARACAO", "SEPARADO"].includes(status);
          const isNovo = status === "NOVO";
          const isErro = status === "DIVERGENTE" || status === "ERRO" || status === "CANCELADO";
    
          return [
            {
              title: "Pedido Recebido",
              sub: "O pedido foi importado com sucesso",
              titleColor: t.text,
              dot: successColor,
              halo: successHalo,
              line: successColor,
            },
            {
              title: "Em Separação",
              sub: "Coletando os itens no armazém",
              titleColor: (isSeparacao || isConferencia || isConferidoExpedido) ? t.text : t.textSub,
              dot: isConferidoExpedido || isConferencia ? successColor : (isSeparacao ? activeColor : pendingColor),
              halo: isConferidoExpedido || isConferencia ? successHalo : (isSeparacao ? activeHalo : "transparent"),
              line: isConferidoExpedido || isConferencia ? successColor : pendingColor,
            },
            {
              title: "Em Conferência",
              sub: "Conferindo os itens",
              titleColor: (isConferencia || isConferidoExpedido) ? t.text : t.textSub,
              dot: isConferidoExpedido ? successColor : (isConferencia ? activeColor : pendingColor),
              halo: isConferidoExpedido ? successHalo : (isConferencia ? activeHalo : "transparent"),
              line: isConferidoExpedido ? successColor : pendingColor,
            },
            {
              title: isErro ? "Problema/Erro" : "Despachado",
              sub: isErro ? "Atenção necessária" : "Pedido pronto para expedição",
              titleColor: isConferidoExpedido ? t.text : (isErro ? "#EF4444" : t.textSub),
              dot: isConferidoExpedido ? successColor : (isErro ? "#EF4444" : pendingColor),
              halo: isConferidoExpedido ? successHalo : (isErro ? "rgba(239, 68, 68, 0.15)" : "transparent"),
              line: "transparent",
            }
          ];
        };

        const steps = getTimelineSteps(sel.raw.status, t);
        const specs = [
          { k: "Canal", v: sel.carrier },
          { k: "Depositante", v: sel.owner },
          { k: "Nota Fiscal", v: sel.raw.nfe || "-" },
          { k: "Corte (SLA)", v: sel.sla }
        ];

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
            <div
              onClick={() => setSelectedOrder(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(6, 10, 20, 0.55)", backdropFilter: "blur(3px)", animation: "overlayFade 0.25s ease" }}
            ></div>
            <div style={{ position: "relative", width: "440px", maxWidth: "92vw", height: "100%", background: t.cardBg, borderLeft: \`1px solid \${t.border}\`, boxShadow: "-24px 0 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", animation: "drawerIn 0.32s cubic-bezier(.3,1,.4,1)", overflow: "hidden" }}>
              <div style={{ position: "relative", padding: "24px", borderBottom: \`1px solid \${t.border}\`, overflow: "hidden" }}>
                <div style={{ position: "absolute", width: "240px", height: "240px", right: "-80px", top: "-110px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139, 92, 246, 0.28), transparent 70%)", pointerEvents: "none" }}></div>
                <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.12em", color: t.textSub }}>PEDIDO</span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "26px", fontWeight: "700", lineHeight: "1" }}>{sel.code}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", alignSelf: "flex-start", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", background: sel.statusBg, color: sel.statusColor }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: sel.statusDot }}></span>{sel.statusLabel}
                    </span>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} style={{ width: "36px", height: "36px", flexShrink: "0", borderRadius: "10px", border: \`1px solid \${t.border}\`, background: t.inputBg, color: t.textSub, fontSize: "16px", cursor: "pointer" }}>✕</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "15px", fontWeight: "700" }}>{sel.customer}</span>
                  <span style={{ fontSize: "12.5px", color: t.textSub }}>{sel.owner} · {sel.city}</span>
                </div>
                {/* progress steps */}
                <div style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {steps.map((st, i) => (
                    <div key={i} style={{ display: "flex", gap: "14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "12px" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: st.dot, boxShadow: \`0 0 0 3px \${st.halo}\`, marginTop: "3px" }}></span>
                        <span style={{ flex: 1, width: "2px", background: st.line }}></span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingBottom: "16px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: "700", color: st.titleColor }}>{st.title}</span>
                        <span style={{ fontSize: "12px", color: t.textSub }}>{st.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* specs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {specs.map((s, i) => (
                    <div key={i} style={{ padding: "14px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.softBg, display: "flex", flexDirection: "column", gap: "5px" }}>
                      <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.k}</span>
                      <span style={{ fontSize: "14.5px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.v}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: \`1px solid \${t.border}\`, display: "flex", gap: "10px", background: t.cardBg }}>
                <button style={{ flex: 1, height: "46px", borderRadius: "11px", border: \`1px solid \${t.border}\`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>⎙ Romaneio</button>
                <a href="/m/separacao" style={{ flex: 1.4, height: "46px", border: "none", borderRadius: "11px", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99, 102, 241, 0.32)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Iniciar separação</a>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* CSS for animations */}
      <style dangerouslySetInnerHTML={{__html: \`
        @keyframes drawerIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes overlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      \`}} />
`;

t = t.replace('</>', drawerCode + '\n      </>');

fs.writeFileSync('src/components/expedicao/expedicao-client.tsx', t, 'utf8');
console.log("Drawer patched successfully!");
