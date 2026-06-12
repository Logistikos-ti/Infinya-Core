import Link from "next/link";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { DocumentUploadPanel } from "@/components/storage/document-upload-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listNfeInbox } from "@/lib/wms-data";

export default async function NfePage() {
  const nfeInbox = listNfeInbox();
  const supabase = await createSupabaseServerClient();

  const [{ data: depositantes }, { data: documentos }] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    supabase
      .from("documentos_armazenados")
      .select("id, nome_arquivo, tipo, created_at, depositante:depositantes(nome)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const depositanteOptions =
    depositantes?.map((item) => ({
      id: item.id,
      nome: item.nome,
    })) ?? [];

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
            O MVP já contempla leitura e importação de XML, com storage operacional
            pronto para anexos fiscais e documentos de apoio.
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
                {nfeInbox.map((item) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DocumentUploadPanel
          defaultDepositanteId={depositanteOptions[0]?.id ?? null}
          depositantes={depositanteOptions}
        />
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
              {documentos?.length ? (
                documentos.map((item) => (
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
