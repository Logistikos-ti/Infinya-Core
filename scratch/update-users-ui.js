const fs = require('fs');

const path = 'src/app/(dashboard)/configuracoes/usuarios/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950/40 mt-4">
                  <div className="min-w-[900px]">
                    <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-white/10 dark:bg-zinc-900/50">
                      <span className="flex-[2.2] font-['Space_Grotesk'] text-[11.5px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">Usuário</span>
                      <span className="flex-[1.1] font-['Space_Grotesk'] text-[11.5px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">Papel</span>
                      <span className="flex-1 font-['Space_Grotesk'] text-[11.5px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">ID</span>
                      <span className="flex-[1.6] font-['Space_Grotesk'] text-[11.5px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">Depositante</span>
                      <span className="flex-[1.2] font-['Space_Grotesk'] text-[11.5px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">Último acesso</span>
                      <span className="flex-[2.2] text-right font-['Space_Grotesk'] text-[11.5px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">Status / Ações</span>
                    </div>

                    {paginatedUsers.map((item) => {
                      const isCurrentUser = currentUser.id === item.id;
                      const initials = item.nome.substring(0, 2).toUpperCase();
                      const avatarBg = item.ativo ? "bg-gradient-to-br from-indigo-500 to-purple-600" : "bg-slate-300 dark:bg-slate-700";

                      const roleColor = item.papel === "ADMIN" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" 
                        : item.papel === "TI" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        : item.papel === "DEPOSITANTE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300";

                      const statusBg = item.ativo ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400";
                      const statusDot = item.ativo ? "bg-emerald-500" : "bg-slate-400";

                      return (
                        <div key={item.id} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02] last:border-0">
                          
                          <div className="flex flex-[2.2] items-center gap-3 min-w-0">
                            <span className={\`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] font-['Space_Grotesk'] text-[13.5px] font-extrabold text-white \${avatarBg}\`}>
                              {initials}
                            </span>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{item.nome}</span>
                              <span className="truncate text-xs text-slate-500 dark:text-slate-400">{item.login || "Sem login"}</span>
                            </div>
                          </div>

                          <div className="flex flex-[1.1] items-center">
                            <span className={\`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold \${roleColor}\`}>
                              {getRoleLabel(item.papel)}
                            </span>
                          </div>

                          <span className="font-['Space_Grotesk'] flex-1 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                            {item.id.split("-")[0]}
                          </span>

                          <div className="flex flex-[1.6] items-center min-w-0">
                            <span className="truncate text-[13px] text-slate-900 dark:text-slate-100">
                              {getDepositanteLabel(item.depositante)}
                            </span>
                          </div>

                          <span className="flex-[1.2] text-[12.5px] text-slate-500 dark:text-slate-400">
                            {item.ultimo_acesso_em ? formatDateTimePtBr(item.ultimo_acesso_em).split(" ")[0] : "Nunca"}
                          </span>

                          <div className="flex flex-[2.2] items-center justify-end gap-2.5">
                            <span className={\`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold \${statusBg}\`}>
                              <span className={\`h-1.5 w-1.5 rounded-full \${statusDot}\`}></span>
                              {item.ativo ? "Ativo" : "Inativo"}
                            </span>

                            <form action={toggleUsuarioStatusAction}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="nextActive" value={item.ativo ? "false" : "true"} />
                              <button
                                type="submit"
                                disabled={isCurrentUser && item.ativo}
                                title={item.ativo ? "Desativar" : "Ativar"}
                                className={\`relative flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-none transition-colors \${
                                  item.ativo ? "bg-indigo-500" : "bg-slate-200 dark:bg-zinc-700"
                                }\`}
                              >
                                <span
                                  className={\`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-[cubic-bezier(.4,1.3,.5,1)] \${
                                    item.ativo ? "translate-x-[20px]" : "translate-x-0"
                                  }\`}
                                ></span>
                              </button>
                            </form>

                            <Link
                              href={\`/configuracoes/usuarios?editar=\${item.id}\`}
                              title="Editar"
                              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-slate-200 bg-slate-50/50 text-slate-600 transition hover:border-indigo-500 hover:text-indigo-500 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-400"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Link>

                            <form action={deleteUsuarioAction}>
                              <input type="hidden" name="id" value={item.id} />
                              <button
                                type="submit"
                                disabled={isCurrentUser}
                                title="Excluir"
                                className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-rose-200/50 bg-rose-50 text-rose-500 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>`;

const startIndex = content.indexOf('{paginatedUsers.map((item) => {');
const endIndex = content.indexOf('</>', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex + 3);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully replaced list UI');
} else {
  console.log('Could not find boundaries');
}
