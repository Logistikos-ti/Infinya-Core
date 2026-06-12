import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { listNfeInbox } from "@/lib/wms-data";

export default function NfePage() {
  const nfeInbox = listNfeInbox();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="NFe"
        description="Consulta fiscal, parsing XML e vínculo com recebimento e expedição."
        badge="Planejado"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Inbox fiscal</h2>
        <p className="mt-1 text-sm text-slate-600">
          O MVP considera leitura e importação de XML, sem emissão própria nesta fase.
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
    </div>
  );
}
