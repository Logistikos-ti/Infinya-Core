const fs = require('fs');
const path = require('path');
const p = path.join('src', 'components', 'expedicao', 'expedicao-client.tsx');
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('ShippingAttachmentUploadPanel')) {
  c = c.replace(
    `import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";`,
    `import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";\nimport { ShippingAttachmentUploadPanel } from "@/components/shipping/shipping-attachment-upload-panel";\nimport { createPortal } from "react-dom";`
  );
}

// Add state for upload modal
if (!c.includes('uploadModalOpen')) {
  c = c.replace(
    `  const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview');`,
    `  const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview');\n  const [uploadModalOpen, setUploadModalOpen] = useState<{ open: boolean; type: "NF" | "ETIQUETA" }>({ open: false, type: "NF" });`
  );
}

// Update the buttons block
const targetButtons = `                <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                  <ShippingAttachmentPreviewDialog
                    label="Nota Fiscal"
                    viewHref={\`/api/expedicao/\${sel.raw.id}/nota-fiscal-preview?disposition=inline\`}
                    downloadHref={\`/api/expedicao/\${sel.raw.id}/nota-fiscal-preview?disposition=attachment\`}
                    customTrigger={(openPreview) => (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openPreview(); }}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                        className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                      >
                        <FileText size={20} color={t.textSub} />
                        <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center" }}>Visualizar NF</span>
                      </button>
                    )}
                  />
                  <ShippingAttachmentPreviewDialog
                    label="DANFE Simplificada"
                    viewHref={\`/api/expedicao/\${sel.raw.id}/danfe-simplificada?disposition=inline\`}
                    downloadHref={\`/api/expedicao/\${sel.raw.id}/danfe-simplificada?disposition=attachment\`}
                    customTrigger={(openPreview) => (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openPreview(); }}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                        className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                      >
                        <Receipt size={20} color={t.textSub} />
                        <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center", lineHeight: "1.2" }}>DANFE<br/>Simplificada</span>
                      </button>
                    )}
                  />
                  <ShippingAttachmentPreviewDialog
                    label="Etiqueta de Envio"
                    viewHref={\`/api/expedicao/\${sel.raw.id}/anexos/etiqueta?disposition=inline\`}
                    downloadHref={\`/api/expedicao/\${sel.raw.id}/anexos/etiqueta?disposition=attachment\`}
                    customTrigger={(openPreview) => (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openPreview(); }}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                        className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                      >
                        <Tag size={20} color={t.textSub} />
                        <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center", lineHeight: "1.2" }}>Etiqueta<br/>de Envio</span>
                      </button>
                    )}
                  />
                </div>`;

const replaceButtons = `                <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                  <ShippingAttachmentPreviewDialog
                    label="Nota Fiscal"
                    viewHref={\`/api/expedicao/\${sel.raw.id}/nota-fiscal-preview?disposition=inline\`}
                    downloadHref={\`/api/expedicao/\${sel.raw.id}/nota-fiscal-preview?disposition=attachment\`}
                    customTrigger={(openPreview) => (
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (sel.raw.hasNfe) { openPreview(); } else { setUploadModalOpen({ open: true, type: "NF" }); } }}
                        style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                        className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                      >
                        {sel.raw.hasNfe ? (
                          <div style={{ position: "absolute", top: "6px", right: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>✓</div>
                        ) : (
                          <div style={{ position: "absolute", top: "6px", right: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "#F43F5E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>✕</div>
                        )}
                        <FileText size={20} color={t.textSub} />
                        <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center" }}>Visualizar NF</span>
                      </button>
                    )}
                  />
                  <ShippingAttachmentPreviewDialog
                    label="DANFE Simplificada"
                    viewHref={\`/api/expedicao/\${sel.raw.id}/danfe-simplificada?disposition=inline\`}
                    downloadHref={\`/api/expedicao/\${sel.raw.id}/danfe-simplificada?disposition=attachment\`}
                    customTrigger={(openPreview) => (
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (sel.raw.hasNfe) { openPreview(); } else { setUploadModalOpen({ open: true, type: "NF" }); } }}
                        style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                        className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                      >
                        {sel.raw.hasNfe ? (
                          <div style={{ position: "absolute", top: "6px", right: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>✓</div>
                        ) : (
                          <div style={{ position: "absolute", top: "6px", right: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "#F43F5E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>✕</div>
                        )}
                        <Receipt size={20} color={t.textSub} />
                        <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center", lineHeight: "1.2" }}>DANFE<br/>Simplificada</span>
                      </button>
                    )}
                  />
                  <ShippingAttachmentPreviewDialog
                    label="Etiqueta de Envio"
                    viewHref={\`/api/expedicao/\${sel.raw.id}/anexos/etiqueta?disposition=inline\`}
                    downloadHref={\`/api/expedicao/\${sel.raw.id}/anexos/etiqueta?disposition=attachment\`}
                    customTrigger={(openPreview) => (
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (sel.raw.hasEtiqueta) { openPreview(); } else { setUploadModalOpen({ open: true, type: "ETIQUETA" }); } }}
                        style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                        className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                      >
                        {sel.raw.hasEtiqueta ? (
                          <div style={{ position: "absolute", top: "6px", right: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>✓</div>
                        ) : (
                          <div style={{ position: "absolute", top: "6px", right: "6px", width: "16px", height: "16px", borderRadius: "50%", background: "#F43F5E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>✕</div>
                        )}
                        <Tag size={20} color={t.textSub} />
                        <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center", lineHeight: "1.2" }}>Etiqueta<br/>de Envio</span>
                      </button>
                    )}
                  />
                </div>`;

let cNormalized = c.replace(/\r\n/g, '\n');
if (cNormalized.includes(targetButtons)) {
  cNormalized = cNormalized.replace(targetButtons, replaceButtons);
} else {
  console.log('Target buttons not found in expedicao-client.tsx!');
}

const targetEnd = `      {isPedidosFull && (`;
const replaceEnd = `      {uploadModalOpen.open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" onClick={() => setUploadModalOpen({ open: false, type: "NF" })}>
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-950 dark:text-white">Anexar documento</h4>
              <button onClick={() => setUploadModalOpen({ open: false, type: "NF" })} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-white">✕</button>
            </div>
            <p className="mb-6 text-sm text-slate-600 dark:text-zinc-400">
              O pedido <strong>{sel?.code}</strong> não possui <strong>{uploadModalOpen.type === "NF" ? "Nota Fiscal" : "Etiqueta"}</strong>. Faça o upload abaixo para vinculá-lo.
            </p>
            {sel?.raw?.id && sel?.raw?.depositanteId ? (
              <ShippingAttachmentUploadPanel
                depositanteId={sel.raw.depositanteId}
                pedidoExpedicaoId={sel.raw.id}
              />
            ) : (
              <p className="text-sm text-rose-500">Erro: Pedido não possui depositante vinculado.</p>
            )}
          </div>
        </div>, document.body
      ) : null}

      {isPedidosFull && (`;

if (cNormalized.includes(targetEnd)) {
  cNormalized = cNormalized.replace(targetEnd, replaceEnd);
} else {
  console.log('Target end not found!');
}

fs.writeFileSync(p, cNormalized);
console.log('Successfully patched expedicao-client.tsx with upload modal');
