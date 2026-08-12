const fs = require('fs');
let code = fs.readFileSync('src/components/configuracoes/infinoos-configuracoes-view.tsx', 'utf8');

// 1. Add "TI" to the roles
code = code.replace(
  `{["Operador", "Conferente", "Supervisor", "Gestor", "Administrador"].map(role => {`,
  `{["Operador", "Conferente", "Supervisor", "Gestor", "Administrador", "TI"].map(role => {`
);

// 2. Dynamic depositantes
code = code.replace(
  `{["Todos os depositantes", "Loja Alpha", "BemStar", "CasaMais", "John Skull"].map(dep => {`,
  `{["Todos os depositantes", ...(initialDepositantes?.map(d => d.nome) || [])].map(dep => {`
);

// 3. System permissions
const oldPermsHtml = `<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {[{ id: "recebimento", title: "Recebimento", desc: "Conferir entradas e NFs" }, { id: "estoque", title: "Estoque", desc: "Consultar e ajustar saldos" }, { id: "expedicao", title: "Expedição", desc: "Separar, conferir e expedir" }].map(mod => {
                    const active = userForm.permissoes[mod.id as keyof typeof userForm.permissoes];
                    return <div key={mod.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "14px", fontWeight: 700, color: t.text }}>{mod.title}</span><span style={{ fontSize: "13px", color: t.textSub }}>{mod.desc}</span></div><button onClick={() => setUserForm(p => ({ ...p, permissoes: { ...p.permissoes, [mod.id]: !active } }))} style={{ position: "relative", width: "42px", height: "24px", borderRadius: "12px", background: active ? "#10B981" : t.border, border: "none", cursor: "pointer", transition: "background 0.25s ease", outline: "none" }}><span style={{ position: "absolute", top: "2px", left: "2px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transform: active ? "translateX(18px)" : "translateX(0)", transition: "transform 0.25s cubic-bezier(.4,1.3,.5,1)" }} /></button></div>;
                  })}
                </div>`;

const newPermsHtml = `<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {Object.keys(defaultPerms).map((tabName) => {
                    const subTabs = (userForm.permissoes as any)[tabName] || {};
                    return (
                      <div key={tabName} style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "18px", borderBottom: \`1px solid \${t.border}\` }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: t.text }}>{tabName}</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          {Object.keys(subTabs).map((subName) => {
                            const active = subTabs[subName];
                            return (
                              <div key={subName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", background: t.inputBg, border: \`1px solid \${t.border}\` }}>
                                <span style={{ fontSize: "13px", fontWeight: 500, color: t.textSub }}>{subName}</span>
                                <button 
                                  onClick={() => setUserForm(p => ({ 
                                    ...p, 
                                    permissoes: { 
                                      ...p.permissoes, 
                                      [tabName]: { ...(p.permissoes as any)[tabName], [subName]: !active } 
                                    } 
                                  }))}
                                  style={{ position: "relative", width: "42px", height: "24px", borderRadius: "12px", background: active ? "#10B981" : t.border, border: "none", cursor: "pointer", transition: "background 0.25s ease", outline: "none", flexShrink: 0 }}
                                >
                                  <span style={{ position: "absolute", top: "2px", left: "2px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transform: active ? "translateX(18px)" : "translateX(0)", transition: "transform 0.25s cubic-bezier(.4,1.3,.5,1)" }} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>`;

code = code.replace(oldPermsHtml, newPermsHtml);

fs.writeFileSync('src/components/configuracoes/infinoos-configuracoes-view.tsx', code);
console.log("Patch applied successfully!");
