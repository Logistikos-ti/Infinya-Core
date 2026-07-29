const fs = require('fs');
const path = require('path');
const p = path.join('src', 'components', 'expedicao', 'expedicao-client.tsx');
let c = fs.readFileSync(p, 'utf8');
const target = `                      </div>
                    </div>
                  </div>
                </div>

                {/* carrier + dock + specs */}`;
const replace = `                      </div>
                    </div>
                  </div>
                </div>

                {/* Document buttons */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.open(\`/api/expedicao/\${sel.raw.id}/nota-fiscal-preview?disposition=inline\`, "_blank", "width=900,height=700"); }}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                    className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                  >
                    <FileText size={20} color={t.textSub} />
                    <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center" }}>Visualizar NF</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.open(\`/api/expedicao/\${sel.raw.id}/danfe-simplificada?disposition=inline\`, "_blank", "width=900,height=700"); }}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                    className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                  >
                    <Receipt size={20} color={t.textSub} />
                    <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center", lineHeight: "1.2" }}>DANFE<br/>Simplificada</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.open(\`/api/expedicao/\${sel.raw.id}/anexos/etiqueta?disposition=inline\`, "_blank", "width=900,height=700"); }}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 8px", borderRadius: "12px", border: \`1px solid \${t.border}\`, background: t.cardBg, color: t.text, cursor: "pointer", transition: "all 0.2s" }}
                    className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                  >
                    <Tag size={20} color={t.textSub} />
                    <span style={{ fontSize: "12px", fontWeight: "600", textAlign: "center", lineHeight: "1.2" }}>Etiqueta<br/>de Envio</span>
                  </button>
                </div>

                {/* carrier + dock + specs */}`;
if (c.includes(target)) {
  c = c.replace(target, replace);
  fs.writeFileSync(p, c);
  console.log('Successfully patched UI');
} else {
  console.log('Target not found!');
}
