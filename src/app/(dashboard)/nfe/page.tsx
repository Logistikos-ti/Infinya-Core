import Link from "next/link";
import { Lock } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { DocumentUploadPanel } from "@/components/storage/document-upload-panel";
import { requireModuleAccess } from "@/lib/auth";
import { canUploadOperationalDocuments } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser, filterItemsByUserDepositante } from "@/lib/tenant-scope";
import { listNfeInbox } from "@/lib/wms-data";

export default async function NfePage() {
  const user = await requireModuleAccess("nfe");
  const uploadEnabled = canUploadOperationalDocuments(user);
  const supabase = await createSupabaseServerClient();

  const [{ data: depositantes }, { data: documentos }] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    supabase
      .from("documentos_armazenados")
      .select("id, nome_arquivo, tipo, created_at, depositante_id, depositante:depositantes(nome)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const depositanteOptions = filterDepositanteOptionsByUser(
    user,
    (depositantes ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
    })),
  );

  const nfeInbox = filterItemsByUserDepositante(user, listNfeInbox(), (item) => {
    if (item.linked === "REC-240610-001") return "Evolveg";
    if (item.linked === "REC-240610-003") return "Sua Aliada";
    return null;
  });

  const visibleDocuments =
    user.depositanteId && user.papel === "DEPOSITANTE"
      ? (documentos ?? []).filter((item) => item.depositante_id === user.depositanteId)
      : (documentos ?? []);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="NFe"
        description="Consulta fiscal, parsing XML, storage operacional e vínculo com recebimento e expedição."
        badge="Semana 1"
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Inbox fiscal</h2>
          <p className="mt-1 text-sm text-slate-600">
            O MVP já contempla leitura e importação de XML, com storage operacional pronto
            para anexos fiscais e documentos de apoio.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Chave</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium">Vínculo</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {nfeInbox.length ? (
                  nfeInbox.map((item) => (
                    <tr key={item.key} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 font-medium text-slate-900">{item.key}</td>
                      <td className="py-3 text-slate-600">{item.type}</td>
                      <td className="py-3 text-slate-600">{item.linked}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Nenhum documento fiscal disponível para o seu depositante.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {uploadEnabled ? (
          <DocumentUploadPanel
            defaultDepositanteId={depositanteOptions[0]?.id ?? null}
            depositantes={depositanteOptions}
            lockDepositante={user.papel === "DEPOSITANTE"}
          />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-800">
              <Lock className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Upload restrito</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              Seu perfil pode consultar os documentos e acompanhar o histórico fiscal, mas
              o envio de novos arquivos está liberado somente para Admin, TI e Operador.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Documentos armazenados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Últimos arquivos enviados para o bucket privado do Supabase.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            Bucket: wms-documentos
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Arquivo</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Depositante</th>
                <th className="pb-3 font-medium">Enviado em</th>
                <th className="pb-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.length ? (
                visibleDocuments.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 font-medium text-slate-900">{item.nome_arquivo}</td>
                    <td className="py-3 text-slate-600">{item.tipo}</td>
                    <td className="py-3 text-slate-600">
                      {((item.depositante as { nome?: string } | null) ?? null)?.nome ?? "-"}
                    </td>
                    <td className="py-3 text-slate-600">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/api/documentos/${item.id}/download`}
                        className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
                        target="_blank"
                      >
                        Baixar
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Nenhum documento enviado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
