"use client";

import { Check, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import {
  decodeXmlBuffer,
  matchNfeProductsToCatalog,
  parseNfeXml,
} from "@/lib/nfe-import";

type ReceivingDetailItem = {
  id: string;
  sku: string;
  nome: string;
  expected: number;
  received: number;
  status: string;
};

type ReceivingItem = {
  id: string;
  code: string;
  supplier: string | null;
  volumeCount: number | null;
  eta: string | null;
  etaTime?: string | null;
  status: string;
  noteNumber: string;
  xmlAttached: boolean;
  items: ReceivingDetailItem[];
};

type ProductOption = {
  id: string;
  nome: string;
  sku: string;
  unidade: string;
  codigoInterno?: string | null;
  codigoExterno?: string | null;
};

type ReceivingViewClientProps = {
  receiving: ReceivingItem[];
  depositanteId: string;
  products: ProductOption[];
};

type ItemLine = {
  key: string;
  produtoId: string;
  quantidade: string;
  origem?: string;
};

type XmlPreview = {
  noteNumber: string;
  supplierName: string;
  matchedCount: number;
  unmatched: Array<{
    descricao: string;
    codigo: string | null;
    ean: string | null;
    quantidade: number;
  }>;
};

const inputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-white/10";

function emptyItemLine(): ItemLine {
  return { key: crypto.randomUUID(), produtoId: "", quantidade: "" };
}

export function ReceivingViewClient({ receiving, depositanteId, products }: ReceivingViewClientProps) {
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selected, setSelected] = useState<ReceivingItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlPreview, setXmlPreview] = useState<XmlPreview | null>(null);
  const [xmlReading, setXmlReading] = useState(false);
  const [type, setType] = useState("NF-e XML");
  const [items, setItems] = useState<ItemLine[]>([emptyItemLine()]);
  const [form, setForm] = useState({
    supplier: "",
    nf: "",
    eta: "",
    hour: "",
    notes: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function openDrawer() {
    setError("");
    setOpen(true);
    requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeDrawer() {
    setDrawerVisible(false);
    window.setTimeout(() => setOpen(false), 220);
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function selectXml(file?: File) {
    if (!file) return;
    setXmlFile(file);
    setXmlPreview(null);
    setError("");
    setXmlReading(true);

    try {
      const xmlText = decodeXmlBuffer(await file.arrayBuffer());
      const parsedXml = parseNfeXml(xmlText);
      const matching = matchNfeProductsToCatalog(
        parsedXml.items,
        products.map((product) => ({
          id: product.id,
          nome: product.nome,
          sku: product.sku,
          codigo_interno: product.codigoInterno ?? product.sku,
          codigo_externo: product.codigoExterno ?? null,
        })),
      );

      setForm((current) => ({
        ...current,
        supplier: parsedXml.supplierName,
        nf: parsedXml.noteNumber,
      }));
      setItems(
        matching.matched.length
          ? matching.matched.map((item) => ({
              key: crypto.randomUUID(),
              produtoId: item.productId,
              quantidade: String(item.quantidade),
              origem: item.origemEan ?? item.origemCodigo ?? item.sku,
            }))
          : [emptyItemLine()],
      );
      setXmlPreview({
        noteNumber: parsedXml.noteNumber,
        supplierName: parsedXml.supplierName,
        matchedCount: matching.matched.length,
        unmatched: matching.unmatched.map((item) => ({
          descricao: item.descricao,
          codigo: item.codigo,
          ean: item.ean,
          quantidade: item.quantidade,
        })),
      });
    } catch (xmlError) {
      setError(
        xmlError instanceof Error
          ? xmlError.message
          : "Nao foi possivel ler o XML da NF-e.",
      );
      setItems([emptyItemLine()]);
    } finally {
      setXmlReading(false);
    }
  }

  function updateItemLine(key: string, field: "produtoId" | "quantidade", value: string) {
    setItems((current) =>
      current.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    );
  }

  function addItemLine() {
    setItems((current) => [...current, emptyItemLine()]);
  }

  function removeItemLine(key: string) {
    setItems((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));
  }

  async function submitXmlImport() {
    if (!xmlFile) {
      setError("Selecione um XML da NF-e antes de importar.");
      return;
    }
    if (!form.eta) {
      setError("Informe a data prevista para agendar a entrada no CD.");
      return;
    }
    if (xmlPreview?.unmatched.length) {
      setError("Existem itens do XML sem vinculo com produtos cadastrados. Ajuste o cadastro antes de enviar.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("depositanteId", depositanteId);
      formData.append("arquivo", xmlFile);
      formData.append("previstoPara", form.eta);
      formData.append("horarioPrevisto", form.hour);
      formData.append("observacoes", form.notes);

      const response = await fetch("/api/recebimento/importar-xml", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        unmatchedItems?: Array<{ descricao: string }>;
      };

      if (!response.ok) {
        const unmatchedMessage = payload.unmatchedItems?.length
          ? ` Itens sem vínculo: ${payload.unmatchedItems.slice(0, 4).map((item) => item.descricao).join(", ")}${payload.unmatchedItems.length > 4 ? "..." : ""}`
          : "";
        throw new Error(`${payload.error ?? "Falha ao importar o XML."}${unmatchedMessage}`);
      }

      resetAndClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Não foi possível importar o XML.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    closeDrawer();
    setForm({ supplier: "", nf: "", eta: "", hour: "", notes: "" });
    setXmlFile(null);
    setXmlPreview(null);
    setItems([emptyItemLine()]);
    router.refresh();
  }

  async function submitManualRequest() {
    const validItems = items
      .map((line) => ({ produtoId: line.produtoId, quantidade: Number(line.quantidade) }))
      .filter((line) => line.produtoId && Number.isFinite(line.quantidade) && line.quantidade > 0);

    if (!validItems.length) {
      setError("Adicione ao menos um item com produto e quantidade.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/portal/recebimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type, items: validItems }),
      });
      const responseText = await response.text();
      let payload: { error?: string } = {};
      try {
        payload = responseText
          ? (JSON.parse(responseText) as { error?: string })
          : {};
      } catch {
        payload = { error: responseText.replace(/<[^>]*>/g, "").trim() };
      }
      if (!response.ok) {
        throw new Error(
          payload.error ||
            `Não foi possível enviar a solicitação (HTTP ${response.status}).`,
        );
      }
      resetAndClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar a solicitação.",
      );
    } finally {
      setSaving(false);
    }
  }

  function submitRequest() {
    if (type === "NF-e XML") {
      void submitXmlImport();
      return;
    }
    void submitManualRequest();
  }

  async function cancelOrder() {
    if (!selected) return;
    if (!window.confirm(`Cancelar a solicitação ${selected.code}? Essa ação não pode ser desfeita.`)) {
      return;
    }

    setCancelling(true);
    setCancelError("");
    try {
      const response = await fetch(`/api/portal/recebimentos/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível cancelar o recebimento.");
      }

      setSelected(null);
      router.refresh();
    } catch (cancelErr) {
      setCancelError(
        cancelErr instanceof Error ? cancelErr.message : "Não foi possível cancelar o recebimento.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const displayStatus = (status: string) => {
    const labels: Record<string, string> = {
      AGUARDANDO: "Agendado",
      AGENDADO: "Agendado",
      EM_RECEBIMENTO: "Em recebimento",
      RECEBIMENTO: "Em recebimento",
      CONFERIDO: "Conferido",
      DIVERGENCIA: "Divergência",
      DIVERGÊNCIA: "Divergência",
      CANCELADO: "Cancelado",
    };
    return labels[status] ?? status;
  };

  const statusStyle = (status: string) => {
    const label = displayStatus(status);
    if (label === "Conferido") {
      return {
        background: "bg-emerald-500/10",
        color: "text-emerald-600 dark:text-emerald-300",
        dot: "bg-emerald-500",
      };
    }
    if (label === "Em recebimento") {
      return {
        background: "bg-blue-500/10",
        color: "text-blue-600 dark:text-blue-300",
        dot: "bg-blue-500",
      };
    }
    if (label === "Divergência") {
      return {
        background: "bg-rose-500/10",
        color: "text-rose-600 dark:text-rose-300",
        dot: "bg-rose-500",
      };
    }
    if (label === "Cancelado") {
      return {
        background: "bg-slate-500/10",
        color: "text-slate-500 dark:text-slate-400",
        dot: "bg-slate-400",
      };
    }
    return {
      background: "bg-violet-500/10",
      color: "text-violet-600 dark:text-violet-300",
      dot: "bg-violet-500",
    };
  };

  const counts = {
    agendado: receiving.filter(
      (item) => displayStatus(item.status) === "Agendado",
    ).length,
    recebimento: receiving.filter(
      (item) => displayStatus(item.status) === "Em recebimento",
    ).length,
    conferido: receiving.filter(
      (item) => displayStatus(item.status) === "Conferido",
    ).length,
    divergencia: receiving.filter(
      (item) => displayStatus(item.status) === "Divergência",
    ).length,
  };

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="font-display text-[27px] font-bold tracking-tight text-slate-950 dark:text-white">
            Recebimento
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Agende entradas de mercadoria e acompanhe o recebimento no CD.
          </p>
        </div>
        <button
          type="button"
          onClick={openDrawer}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5"
        >
          <span className="text-lg leading-none">+</span>
          Nova solicitação
        </button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniKpi
          label="Agendados"
          value={counts.agendado}
          color="bg-violet-500"
        />
        <MiniKpi
          label="Em recebimento"
          value={counts.recebimento}
          color="bg-blue-500"
        />
        <MiniKpi
          label="Conferidos"
          value={counts.conferido}
          color="bg-emerald-500"
        />
        <MiniKpi
          label="Divergências"
          value={counts.divergencia}
          color="bg-rose-500"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.04em] text-slate-500 dark:bg-white/5">
              <tr>
                {[
                  "Solicitação",
                  "Transportadora",
                  "Volumes",
                  "Previsão",
                  "XML",
                  "Status",
                  "",
                ].map((label) => (
                  <th
                    key={label || "acao"}
                    className="border-b border-slate-200 px-5 py-3 font-bold dark:border-white/10"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receiving.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => {
                    setCancelError("");
                    setSelected(item);
                  }}
                  className="cursor-pointer border-b border-slate-200 text-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <td className="px-5 py-3.5 font-display text-sm font-bold">
                    {item.code}
                  </td>
                  <td className="max-w-[260px] px-5 py-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold">
                        {item.supplier ?? "Fornecedor não informado"}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        NF-e {item.noteNumber || "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-display text-sm font-semibold">
                    {item.volumeCount ?? 0}{" "}
                    {item.volumeCount === 1 ? "vol." : "vols."}
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px] font-semibold">
                    {item.etaTime ?? item.eta ?? "Sem previsão"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[13px] font-bold ${item.xmlAttached ? "text-emerald-500" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      {item.xmlAttached ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      {item.xmlAttached ? "XML anexado" : "Sem XML"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(item.status).background} ${statusStyle(item.status).color}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusStyle(item.status).dot}`}
                      />
                      {displayStatus(item.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-lg font-bold text-slate-400 dark:text-slate-500">
                    ›
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!receiving.length ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma solicitação nesse filtro.
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Nova solicitação de recebimento"
        >
          <button
            type="button"
            aria-label="Fechar nova solicitação"
            onClick={closeDrawer}
            className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[3px]"
          />
          <aside
            className={`relative flex h-full w-[560px] max-w-[96vw] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out dark:border-white/10 dark:bg-[#0c1526] ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden border-b border-slate-200 px-6 py-6 dark:border-white/10">
              <div className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.28),transparent_70%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    SOLICITAÇÃO DE RECEBIMENTO
                  </span>
                  <h3 className="font-display text-2xl font-bold leading-none text-slate-950 dark:text-white">
                    Agendar entrada no CD
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">
                    Informe a nota e anexe o XML para agilizar a conferência.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <section className="space-y-2">
                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                  Tipo de recebimento
                </h4>
                <div className="flex flex-wrap gap-2">
                  {["NF-e XML", "Manual", "Transferência"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setType(item)}
                      className={`h-10 rounded-xl border-[1.5px] px-4 text-[13px] font-bold transition ${type === item ? "border-violet-500 bg-violet-500/10 text-slate-900 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              {type === "NF-e XML" ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed p-5 text-left transition hover:border-violet-500 ${xmlFile ? "border-emerald-500 bg-emerald-500/10" : "border-slate-300 bg-slate-50 dark:border-white/20 dark:bg-white/5"}`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${xmlFile ? "bg-emerald-500/15 text-emerald-500" : "bg-blue-500/15 text-blue-500"}`}
                    >
                      {xmlFile ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {xmlFile?.name ?? "Importar XML da NF-e"}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {xmlReading
                          ? "Lendo XML e cruzando os itens..."
                          : xmlFile
                          ? "Fornecedor e itens serão preenchidos automaticamente"
                          : "Arraste o arquivo ou clique para selecionar"}
                      </span>
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    className="hidden"
                    onChange={(event) => void selectXml(event.target.files?.[0])}
                  />
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                    O sistema lê o XML e vincula os itens aos produtos cadastrados por EAN, código interno ou nome.
                  </p>
                  <section className="space-y-3.5">
                    <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                      Dados da nota
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
                      <label className="space-y-1.5 text-xs text-slate-500">
                        Fornecedor
                        <input
                          className={inputClassName}
                          value={form.supplier}
                          onChange={(event) => updateField("supplier", event.target.value)}
                          placeholder="Preenchido pelo XML"
                        />
                      </label>
                      <label className="space-y-1.5 text-xs text-slate-500">
                        Nº da NF-e
                        <input
                          className={inputClassName}
                          value={form.nf}
                          onChange={(event) => updateField("nf", event.target.value)}
                          placeholder="Preenchido pelo XML"
                        />
                      </label>
                      <DatePickerInput
                        label="Data prevista"
                        name="dataPrevistaXml"
                        value={form.eta}
                        onChange={(value) => updateField("eta", value)}
                        compact
                      />
                      <label className="space-y-1.5 text-xs text-slate-500">
                        Horário previsto
                        <input
                          type="time"
                          className={inputClassName}
                          value={form.hour}
                          onChange={(event) => updateField("hour", event.target.value)}
                        />
                      </label>
                    </div>
                  </section>

                  {xmlPreview ? (
                    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            XML lido com sucesso
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            NF-e {xmlPreview.noteNumber} · {xmlPreview.supplierName}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            xmlPreview.unmatched.length
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                          }`}
                        >
                          {xmlPreview.unmatched.length
                            ? `${xmlPreview.unmatched.length} sem vínculo`
                            : `${xmlPreview.matchedCount} item(ns) vinculado(s)`}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items
                          .filter((line) => line.produtoId)
                          .map((line) => {
                            const product = products.find((item) => item.id === line.produtoId);
                            return (
                              <div
                                key={line.key}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-white/10 dark:bg-[#0c1526]"
                              >
                                <span className="min-w-0 truncate font-bold text-slate-900 dark:text-white">
                                  {product?.nome ?? "Produto vinculado"}
                                </span>
                                <span className="shrink-0 text-slate-500 dark:text-slate-400">
                                  {line.quantidade} un.
                                </span>
                              </div>
                            );
                          })}
                      </div>
                      {xmlPreview.unmatched.length ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                          <p className="font-bold">Itens sem vínculo no cadastro:</p>
                          <ul className="mt-1 space-y-1">
                            {xmlPreview.unmatched.slice(0, 4).map((item) => (
                              <li key={`${item.codigo}-${item.ean}-${item.descricao}`}>
                                {item.descricao} ({item.ean ?? item.codigo ?? "sem código"})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  <label className="block space-y-1.5 text-xs text-slate-500">
                    Observações
                    <textarea
                      className={`${inputClassName} min-h-20 resize-y py-3`}
                      value={form.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                      placeholder="Ex.: entrega paletizada, agendar doca fria..."
                    />
                  </label>
                </>
              ) : (
                <>
                  <section className="space-y-3.5">
                    <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                      Dados da nota
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
                      <label className="space-y-1.5 text-xs text-slate-500">
                        Transportadora
                        <input
                          className={inputClassName}
                          value={form.supplier}
                          onChange={(event) =>
                            updateField("supplier", event.target.value)
                          }
                          placeholder="Ex.: Transportes Rodoline"
                        />
                      </label>
                      <label className="space-y-1.5 text-xs text-slate-500">
                        Nº da NF-e
                        <input
                          className={inputClassName}
                          value={form.nf}
                          onChange={(event) =>
                            updateField("nf", event.target.value)
                          }
                          placeholder="000000"
                        />
                      </label>
                      <DatePickerInput
                        label="Data prevista"
                        name="dataPrevista"
                        value={form.eta}
                        onChange={(value) => updateField("eta", value)}
                        compact
                      />
                      <label className="space-y-1.5 text-xs text-slate-500">
                        Horário previsto
                        <input
                          type="time"
                          className={inputClassName}
                          value={form.hour}
                          onChange={(event) =>
                            updateField("hour", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                        Itens do recebimento
                      </h4>
                      <button
                        type="button"
                        onClick={addItemLine}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar item
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {items.map((line) => (
                        <div key={line.key} className="flex items-center gap-2">
                          <select
                            className={inputClassName}
                            value={line.produtoId}
                            onChange={(event) =>
                              updateItemLine(line.key, "produtoId", event.target.value)
                            }
                          >
                            <option value="">Selecione o produto</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.nome} · {product.sku}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qtd."
                            className={`${inputClassName} w-24 shrink-0`}
                            value={line.quantidade}
                            onChange={(event) =>
                              updateItemLine(line.key, "quantidade", event.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeItemLine(line.key)}
                            disabled={items.length <= 1}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
                            aria-label="Remover item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {products.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Nenhum produto cadastrado ainda para o seu depositante.
                      </p>
                    ) : null}
                  </section>

                  <label className="block space-y-1.5 text-xs text-slate-500">
                    Observações
                    <textarea
                      className={`${inputClassName} min-h-20 resize-y py-3`}
                      value={form.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                      placeholder="Ex.: entrega paletizada, agendar doca fria..."
                    />
                  </label>
                </>
              )}

              {error ? (
                <p className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0c1526]">
              <div className="flex-1" />
              <button
                type="button"
                onClick={closeDrawer}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-800 transition hover:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={saving}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="text-lg leading-none">⇢</span>
                {saving ? <MobileButtonSpinner /> : "Enviar solicitação"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes do recebimento ${selected.code}`}
        >
          <button
            type="button"
            aria-label="Fechar detalhes do recebimento"
            onClick={() => setSelected(null)}
            className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[3px]"
          />
          <aside
            className="relative flex h-full w-[460px] max-w-[92vw] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#0c1526]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-6 dark:border-white/10">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  RECEBIMENTO
                </span>
                <span className="font-display text-2xl font-bold leading-none text-slate-950 dark:text-white">
                  {selected.code}
                </span>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(selected.status).background} ${statusStyle(selected.status).color}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle(selected.status).dot}`} />
                  {displayStatus(selected.status)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4.5 overflow-y-auto px-6 py-6">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {selected.supplier ?? "Fornecedor não informado"}
                </span>
                <span className="text-[12.5px] text-slate-500 dark:text-slate-400">
                  NF-e {selected.noteNumber || "-"} ·{" "}
                  {selected.volumeCount ?? 0} {selected.volumeCount === 1 ? "vol." : "vols."}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Data prevista</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selected.eta ?? "-"}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Horário previsto</span>
                  <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {selected.etaTime ?? "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Volumes</span>
                  <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {selected.volumeCount ?? 0} {selected.volumeCount === 1 ? "vol." : "vols."}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">NF-e (XML)</span>
                  <span
                    className={`text-sm font-bold ${selected.xmlAttached ? "text-emerald-500" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {selected.xmlAttached ? "XML anexado" : "Sem XML"}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                  Itens ({selected.items.length})
                </h4>
                {selected.items.length ? (
                  <div className="space-y-2">
                    {selected.items.map((item) => {
                      const isDivergent = item.status === "DIVERGENCIA";
                      const isDone = item.status === "RECEBIDO";
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-white/10"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                              {item.nome}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{item.sku}</span>
                          </div>
                          <span
                            className={`shrink-0 text-sm font-bold ${
                              isDivergent
                                ? "text-rose-500"
                                : isDone
                                  ? "text-emerald-500"
                                  : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {item.received}/{item.expected}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-white/15 dark:text-slate-400">
                    Nenhum item cadastrado para este recebimento ainda.
                  </p>
                )}
              </div>
            </div>

            {selected.status !== "CANCELADO" ? (
              <div className="shrink-0 border-t border-slate-200 px-6 py-4 dark:border-white/10">
                {cancelError ? (
                  <p className="mb-3 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                    {cancelError}
                  </p>
                ) : null}
                {(selected.status === "AGUARDANDO" || selected.status === "RASCUNHO") &&
                !selected.items.some((item) => item.received > 0) ? (
                  <button
                    type="button"
                    onClick={cancelOrder}
                    disabled={cancelling}
                    className="h-11 w-full rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {cancelling ? <MobileButtonSpinner size={20} /> : "Cancelar solicitação"}
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Este recebimento já está em andamento no CD e não pode mais ser cancelado por aqui.
                  </p>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function MiniKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-[18px] dark:border-white/10 dark:bg-[#101b30]">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="font-display text-[26px] font-bold text-slate-950 dark:text-white">
          {value}
        </span>
      </div>
    </div>
  );
}
