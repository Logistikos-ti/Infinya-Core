"use client";

import { AlertTriangle, Check, Clock, FileText, Link2, PackagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  lote?: string;
  validadeEm?: string;
};

type XmlPreview = {
  noteNumber: string;
  supplierName: string;
  matchedCount: number;
  unmatched: Array<{
    key: string;
    descricao: string;
    codigo: string | null;
    ean: string | null;
    quantidade: number;
    lote?: string | null;
    validadeEm?: string | null;
  }>;
};

type ProductDraft = {
  nome: string;
  sku: string;
  codigoInterno: string;
  codigoExterno: string;
  metodoRetirada: "FEFO" | "FIFO" | "LIFO";
};

const inputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-white/10";

function emptyItemLine(): ItemLine {
  return { key: crypto.randomUUID(), produtoId: "", quantidade: "", lote: "", validadeEm: "" };
}

function createXmlItemKey(item: {
  codigo: string | null;
  ean: string | null;
  descricao: string;
  lote?: string | null;
  validadeEm?: string | null;
}) {
  return [item.codigo ?? "", item.ean ?? "", item.descricao, item.lote ?? "", item.validadeEm ?? ""]
    .map((value) => value.trim().toLocaleLowerCase("pt-BR"))
    .join("|");
}

function createProductDraft(item: XmlPreview["unmatched"][number]): ProductDraft {
  const preferredCode = item.codigo?.trim() || item.ean?.trim() || "";

  return {
    nome: item.descricao,
    sku: preferredCode,
    codigoInterno: preferredCode,
    codigoExterno: item.ean?.trim() || "",
    metodoRetirada: "FEFO",
  };
}

const timeOptions = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
];

function TimePickerInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="space-y-1" ref={containerRef}>
      <span className="block text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-sm text-slate-700 shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus:ring-cyan-900/40"
      >
        <span className="inline-flex items-center gap-3">
          <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className={value ? "" : "text-slate-400 dark:text-slate-500"}>
            {value || "Selecionar horÃ¡rio"}
          </span>
        </span>
      </button>

      {open ? (
        <div className="relative">
          <div className="absolute z-30 mt-2 max-h-72 w-[260px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_18px_60px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950">
            <div className="grid grid-cols-3 gap-2">
              {timeOptions.map((option) => {
                const selected = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    className={`h-10 rounded-xl text-sm font-semibold transition ${
                      selected
                        ? "bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 text-white shadow-[0_10px_25px_rgba(59,130,246,0.35)]"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-3 h-10 w-full rounded-xl border border-slate-200 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Limpar horÃ¡rio
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ReceivingViewClient({ receiving, depositanteId, products }: ReceivingViewClientProps) {
  const [productOptions, setProductOptions] = useState(products);
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selected, setSelected] = useState<ReceivingItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [uploadingDivergenceXml, setUploadingDivergenceXml] = useState(false);
  const [divergenceError, setDivergenceError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlPreview, setXmlPreview] = useState<XmlPreview | null>(null);
  const [xmlResolutions, setXmlResolutions] = useState<Record<string, string>>({});
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [creatingProductKey, setCreatingProductKey] = useState<string | null>(null);
  const [productCreateError, setProductCreateError] = useState<Record<string, string>>({});
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

  useEffect(() => {
    setProductOptions(products);
  }, [products]);

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
        productOptions.map((product) => ({
          id: product.id,
          nome: product.nome,
          sku: product.sku,
          codigo_interno: product.codigoInterno ?? product.sku,
          codigo_externo: product.codigoExterno ?? null,
        })),
      );

      setForm((current) => ({
        ...current,
        nf: parsedXml.noteNumber,
      }));
      setItems(
        matching.matched.length
          ? matching.matched.map((item) => ({
              key: crypto.randomUUID(),
              produtoId: item.productId,
              quantidade: String(item.quantidade),
              origem: item.origemEan ?? item.origemCodigo ?? item.sku,
              lote: item.lote ?? "",
              validadeEm: item.validadeEm ?? "",
            }))
          : [emptyItemLine()],
      );
      setXmlPreview({
        noteNumber: parsedXml.noteNumber,
        supplierName: parsedXml.supplierName,
        matchedCount: matching.matched.length,
        unmatched: matching.unmatched.map((item) => ({
          key: createXmlItemKey(item),
          descricao: item.descricao,
          codigo: item.codigo,
          ean: item.ean,
          quantidade: item.quantidade,
          lote: item.lote,
          validadeEm: item.validadeEm,
        })),
      });
      setXmlResolutions({});
      setProductDrafts(
        Object.fromEntries(
          matching.unmatched.map((item) => {
            const previewItem = {
              key: createXmlItemKey(item),
              descricao: item.descricao,
              codigo: item.codigo,
              ean: item.ean,
              quantidade: item.quantidade,
              lote: item.lote,
              validadeEm: item.validadeEm,
            };

            return [previewItem.key, createProductDraft(previewItem)];
          }),
        ),
      );
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

  function updateItemLine(
    key: string,
    field: "produtoId" | "quantidade" | "lote" | "validadeEm",
    value: string,
  ) {
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

  function resolveXmlItem(item: XmlPreview["unmatched"][number], produtoId: string) {
    setXmlResolutions((current) => {
      const next = { ...current };

      if (produtoId) {
        next[item.key] = produtoId;
      } else {
        delete next[item.key];
      }

      return next;
    });

    setItems((current) => {
      const withoutCurrentXmlItem = current.filter((line) => line.origem !== item.key);

      if (!produtoId) {
        return withoutCurrentXmlItem.length ? withoutCurrentXmlItem : [emptyItemLine()];
      }

      return [
        ...withoutCurrentXmlItem.filter((line) => line.produtoId),
        {
          key: crypto.randomUUID(),
          produtoId,
          quantidade: String(item.quantidade),
          origem: item.key,
          lote: item.lote ?? "",
          validadeEm: item.validadeEm ?? "",
        },
      ];
    });
  }

  function updateProductDraft(key: string, field: keyof ProductDraft, value: string) {
    setProductDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {
          nome: "",
          sku: "",
          codigoInterno: "",
          codigoExterno: "",
          metodoRetirada: "FEFO",
        }),
        [field]: value,
      },
    }));
  }

  async function createProductFromXmlItem(item: XmlPreview["unmatched"][number]) {
    const draft = productDrafts[item.key] ?? createProductDraft(item);

    if (!draft.nome.trim()) {
      setProductCreateError((current) => ({
        ...current,
        [item.key]: "Informe o nome do produto para criar o cadastro.",
      }));
      return;
    }

    setCreatingProductKey(item.key);
    setProductCreateError((current) => ({ ...current, [item.key]: "" }));

    try {
      const response = await fetch("/api/portal/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositanteId,
          nome: draft.nome,
          sku: draft.sku,
          codigoInterno: draft.codigoInterno,
          codigoExterno: draft.codigoExterno,
          metodoRetirada: draft.metodoRetirada,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        product?: ProductOption;
      };

      if (!response.ok || !payload.product) {
        throw new Error(payload.error ?? "Nao foi possivel criar o produto.");
      }

      setProductOptions((current) => {
        if (current.some((product) => product.id === payload.product!.id)) {
          return current;
        }

        return [...current, payload.product!].sort((left, right) =>
          left.nome.localeCompare(right.nome, "pt-BR"),
        );
      });
      resolveXmlItem(item, payload.product.id);
    } catch (createError) {
      setProductCreateError((current) => ({
        ...current,
        [item.key]:
          createError instanceof Error ? createError.message : "Nao foi possivel criar o produto.",
      }));
    } finally {
      setCreatingProductKey(null);
    }
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
    if (!form.supplier.trim()) {
      setError("Informe a transportadora que trarÃ¡ este recebimento.");
      return;
    }
    const unresolvedItems = xmlPreview?.unmatched.filter((item) => !xmlResolutions[item.key]) ?? [];
    if (unresolvedItems.length) {
      setError(
        `Resolva ${unresolvedItems.length} item(ns) sem vinculo antes de enviar a solicitacao.`,
      );
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
      formData.append("transportadora", form.supplier.trim());
      formData.append("observacoes", form.notes);
      formData.append(
        "resolucoesXml",
        JSON.stringify(
          Object.entries(xmlResolutions).map(([key, produtoId]) => ({ key, produtoId })),
        ),
      );
      formData.append(
        "itensXml",
        JSON.stringify(
          items
            .filter((line) => line.produtoId)
            .map((line) => ({
              produtoId: line.produtoId,
              quantidade: line.quantidade,
              lote: line.lote?.trim() || null,
              validadeEm: line.validadeEm || null,
            })),
        ),
      );

      const response = await fetch("/api/recebimento/importar-xml", {
        method: "POST",
        body: formData,
      });
      const responseText = await response.text();
      let payload: {
        error?: string;
        unmatchedItems?: Array<{ descricao: string }>;
      } = {};
      try {
        payload = responseText
          ? (JSON.parse(responseText) as typeof payload)
          : {};
      } catch {
        payload = { error: responseText.replace(/<[^>]*>/g, "").trim() };
      }

      if (!response.ok) {
        const unmatchedMessage = payload.unmatchedItems?.length
          ? ` Itens sem vÃ­nculo: ${payload.unmatchedItems.slice(0, 4).map((item) => item.descricao).join(", ")}${payload.unmatchedItems.length > 4 ? "..." : ""}`
          : "";
        throw new Error(`${payload.error ?? "Falha ao importar o XML."}${unmatchedMessage}`);
      }

      resetAndClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "NÃ£o foi possÃ­vel importar o XML.",
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
        body: JSON.stringify({ ...form, type, items: validItems, depositanteId }),
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
            `NÃ£o foi possÃ­vel enviar a solicitaÃ§Ã£o (HTTP ${response.status}).`,
        );
      }
      resetAndClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "NÃ£o foi possÃ­vel enviar a solicitaÃ§Ã£o.",
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

  async function submitDivergenceXml(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDivergenceXml(true);
    setDivergenceError("");

    const formData = new FormData();
    formData.append("xml", file);

    try {
      const { submitDivergenceXmlCorrection } = await import("@/app/(portal)/portal/xml-divergence-action");
      const res = await submitDivergenceXmlCorrection(selected.id, formData);
      if (res.error) {
        setDivergenceError(res.error);
      } else {
        setSelected(null);
        alert("XML recebido e validado com sucesso! A divergÃªncia foi corrigida.");
      }
    } catch (err: any) {
      setDivergenceError("Falha na comunicaÃ§Ã£o com o servidor.");
    } finally {
      setUploadingDivergenceXml(false);
      e.target.value = "";
    }
  }

  async function cancelOrder() {
    if (!selected) return;
    if (!window.confirm(`Cancelar a solicitaÃ§Ã£o ${selected.code}? Essa aÃ§Ã£o nÃ£o pode ser desfeita.`)) {
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
        throw new Error(payload.error ?? "NÃ£o foi possÃ­vel cancelar o recebimento.");
      }

      setSelected(null);
      router.refresh();
    } catch (cancelErr) {
      setCancelError(
        cancelErr instanceof Error ? cancelErr.message : "NÃ£o foi possÃ­vel cancelar o recebimento.",
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
      DIVERGENCIA: "Divergência (Quarentena)", QUARENTENA_CORRIGIDA: "Quarentena Corrigida",
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
    if (label === "Divergência (Quarentena)", QUARENTENA_CORRIGIDA: "Quarentena Corrigida") {
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
      (item) => displayStatus(item.status) === "Divergência (Quarentena)", QUARENTENA_CORRIGIDA: "Quarentena Corrigida",
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
          Nova solicitaÃ§Ã£o
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
          label="DivergÃªncias"
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
                  "SolicitaÃ§Ã£o",
                  "Transportadora",
                  "Volumes",
                  "PrevisÃ£o",
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
                        {item.supplier ?? "Fornecedor nÃ£o informado"}
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
                    {item.etaTime ?? item.eta ?? "Sem previsÃ£o"}
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
                    â¬º
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!receiving.length ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma solicitaÃ§Ã£o nesse filtro.
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Nova solicitaÃ§Ã£o de recebimento"
        >
          <button
            type="button"
            aria-label="Fechar nova solicitaÃ§Ã£o"
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
                    SOLICITAÃ‡ÃƒO DE RECEBIMENTO
                  </span>
                  <h3 className="font-display text-2xl font-bold leading-none text-slate-950 dark:text-white">
                    Agendar entrada no CD
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">
                    Informe a nota e anexe o XML para agilizar a conferÃªncia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 hover:shadow-lg hover:shadow-violet-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-violet-400/50 dark:hover:bg-violet-500/10 dark:hover:text-white"
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
                  {["NF-e XML", "Manual", "TransferÃªncia"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setType(item)}
                      className={`h-10 rounded-xl border-[1.5px] px-4 text-[13px] font-bold transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-50 hover:text-slate-900 hover:shadow-lg hover:shadow-cyan-500/10 dark:hover:border-cyan-300/70 dark:hover:bg-cyan-500/10 dark:hover:text-white ${type === item ? "border-violet-500 bg-violet-500/10 text-slate-900 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400"}`}
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
                    className={`flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-xl hover:shadow-cyan-500/15 dark:hover:border-cyan-300/70 dark:hover:bg-cyan-500/10 ${xmlFile ? "border-emerald-500 bg-emerald-500/10" : "border-slate-300 bg-slate-50 dark:border-white/20 dark:bg-white/5"}`}
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
                          ? "Fornecedor e itens serÃ£o preenchidos automaticamente"
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
                    O sistema lÃª o XML e vincula os itens aos produtos cadastrados por EAN, cÃ³digo interno ou nome.
                  </p>
                  <section className="space-y-3.5">
                    <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                      Dados da nota
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs text-slate-500">
                        NÂº da NF-e
                        <input
                          className={inputClassName}
                          value={form.nf}
                          onChange={(event) => updateField("nf", event.target.value)}
                          placeholder="Preenchido pelo XML"
                        />
                      </label>
                      <label className="space-y-1.5 text-xs text-slate-500 sm:col-span-2">
                        Transportadora
                        <input
                          className={inputClassName}
                          value={form.supplier}
                          onChange={(event) => updateField("supplier", event.target.value)}
                          placeholder="Ex.: Rodoline, Correios, transportadora prÃ³pria..."
                        />
                      </label>
                      <DatePickerInput
                        label="Data prevista"
                        name="dataPrevistaXml"
                        value={form.eta}
                        onChange={(value) => updateField("eta", value)}
                        compact
                      />
                      <TimePickerInput
                        label="HorÃ¡rio previsto"
                        name="horarioPrevistoXml"
                        value={form.hour}
                        onChange={(value) => updateField("hour", value)}
                      />
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
                            NF-e {xmlPreview.noteNumber} Â· {xmlPreview.supplierName}
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
                            ? `${xmlPreview.unmatched.length} sem vÃ­nculo`
                            : `${xmlPreview.matchedCount} item(ns) vinculado(s)`}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items
                          .filter((line) => line.produtoId)
                          .map((line) => {
                            const product = productOptions.find((item) => item.id === line.produtoId);
                            return (
                              <div
                                key={line.key}
                                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-white/10 dark:bg-[#0c1526]"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <span className="block truncate font-bold text-slate-900 dark:text-white">
                                      {product?.nome ?? "Produto vinculado"}
                                    </span>
                                    <span className="mt-1 block text-slate-500 dark:text-slate-400">
                                      {line.quantidade} un. previstas
                                    </span>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                      line.lote || line.validadeEm
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-300"
                                    }`}
                                  >
                                    {line.lote || line.validadeEm ? "Rastreabilidade informada" : "Sem lote/validade"}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <label className="space-y-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Lote
                                    <input
                                      className={inputClassName}
                                      value={line.lote ?? ""}
                                      onChange={(event) =>
                                        updateItemLine(line.key, "lote", event.target.value)
                                      }
                                      placeholder="Preencha se nÃ£o vier no XML"
                                    />
                                  </label>
                                  <label className="space-y-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Validade
                                    <input
                                      type="date"
                                      className={inputClassName}
                                      value={line.validadeEm ?? ""}
                                      onChange={(event) =>
                                        updateItemLine(line.key, "validadeEm", event.target.value)
                                      }
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        Se a NF-e nÃƒÂ£o trouxer lote e validade para produtos que exigem rastreabilidade, preencha aqui.
                        Caso siga sem essa informaÃƒÂ§ÃƒÂ£o, o operador completa no recebimento fÃƒÂ­sico e isso pode gerar custo operacional na fatura.
                      </div>
                      {xmlPreview.unmatched.length ? (
                        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                          <div className="flex items-start gap-2">
                            <PackagePlus className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                              <p className="font-bold">Resolver itens sem vinculo</p>
                              <p className="mt-0.5 text-amber-800/80 dark:text-amber-100/75">
                                Vincule cada item a um produto existente ou crie um cadastro novo antes de enviar.
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {xmlPreview.unmatched.map((item) => {
                              const resolvedProductId = xmlResolutions[item.key] ?? "";
                              const draft = productDrafts[item.key] ?? createProductDraft(item);
                              const createError = productCreateError[item.key];
                              const creating = creatingProductKey === item.key;

                              return (
                                <article
                                  key={item.key}
                                  className={`rounded-2xl border bg-white p-3 shadow-sm transition dark:bg-[#0c1526] ${
                                    resolvedProductId
                                      ? "border-emerald-200 dark:border-emerald-500/30"
                                      : "border-amber-200 dark:border-amber-500/30"
                                  }`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 dark:text-white">
                                        {item.descricao}
                                      </p>
                                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                                        {item.ean ?? item.codigo ?? "Sem cÃ³digo"} Â· {item.quantidade} un.
                                      </p>
                                    </div>
                                    {resolvedProductId ? (
                                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                                        Resolvido
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 grid grid-cols-1 gap-2">
                                    <label className="space-y-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                      Vincular a produto existente
                                      <span className="relative block">
                                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
                                        <select
                                          className={`${inputClassName} pl-9`}
                                          value={resolvedProductId}
                                          onChange={(event) => resolveXmlItem(item, event.target.value)}
                                        >
                                          <option value="">Selecione um produto cadastrado</option>
                                          {productOptions.map((product) => (
                                            <option key={product.id} value={product.id}>
                                              {product.nome} Â· {product.sku}
                                            </option>
                                          ))}
                                        </select>
                                      </span>
                                    </label>

                                    {!resolvedProductId ? (
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                          Criar produto pelo XML
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                          <input
                                            className={`${inputClassName} sm:col-span-2`}
                                            value={draft.nome}
                                            onChange={(event) =>
                                              updateProductDraft(item.key, "nome", event.target.value)
                                            }
                                            placeholder="Nome do produto"
                                          />
                                          <input
                                            className={inputClassName}
                                            value={draft.sku}
                                            onChange={(event) =>
                                              updateProductDraft(item.key, "sku", event.target.value)
                                            }
                                            placeholder="SKU"
                                          />
                                          <input
                                            className={inputClassName}
                                            value={draft.codigoInterno}
                                            onChange={(event) =>
                                              updateProductDraft(item.key, "codigoInterno", event.target.value)
                                            }
                                            placeholder="Codigo interno"
                                          />
                                          <input
                                            className={`${inputClassName} sm:col-span-2`}
                                            value={draft.codigoExterno}
                                            onChange={(event) =>
                                              updateProductDraft(item.key, "codigoExterno", event.target.value)
                                            }
                                            placeholder="EAN/GTIN"
                                          />
                                          <label className="space-y-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 sm:col-span-2">
                                            MÃƒÂ©todo de retirada
                                            <select
                                              className={inputClassName}
                                              value={draft.metodoRetirada}
                                              onChange={(event) =>
                                                updateProductDraft(
                                                  item.key,
                                                  "metodoRetirada",
                                                  event.target.value as "FEFO" | "FIFO" | "LIFO",
                                                )
                                              }
                                            >
                                              <option value="FEFO">FEFO - validade mais prÃƒÂ³xima sai primeiro</option>
                                              <option value="FIFO">FIFO - primeiro que entra, primeiro que sai</option>
                                              <option value="LIFO">LIFO - ÃƒÂºltimo que entra, primeiro que sai</option>
                                            </select>
                                          </label>
                                        </div>
                                        <p className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-900 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100">
                                          Se nada for alterado, o produto serÃƒÂ¡ criado como FEFO, unidade e com lote/validade obrigatÃƒÂ³rios.
                                        </p>
                                        {createError ? (
                                          <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
                                            {createError}
                                          </p>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => void createProductFromXmlItem(item)}
                                          disabled={creating}
                                          className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-4 text-xs font-bold text-white shadow-[0_12px_30px_rgba(59,130,246,0.25)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
                                        >
                                          {creating ? "Criando..." : "Criar e vincular produto"}
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  <label className="block space-y-1.5 text-xs text-slate-500">
                    ObservaÃ§Ãµes
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs text-slate-500">
                        NÂº da NF-e
                        <input
                          className={inputClassName}
                          value={form.nf}
                          onChange={(event) =>
                            updateField("nf", event.target.value)
                          }
                          placeholder="000000"
                        />
                      </label>
                      <label className="space-y-1.5 text-xs text-slate-500 sm:col-span-2">
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
                      <DatePickerInput
                        label="Data prevista"
                        name="dataPrevista"
                        value={form.eta}
                        onChange={(value) => updateField("eta", value)}
                        compact
                      />
                      <TimePickerInput
                        label="HorÃ¡rio previsto"
                        name="horarioPrevisto"
                        value={form.hour}
                        onChange={(value) => updateField("hour", value)}
                      />
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
                            {productOptions.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.nome} Â· {product.sku}
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
                    {productOptions.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Nenhum produto cadastrado ainda para o seu depositante.
                      </p>
                    ) : null}
                    </section>

                  <label className="block space-y-1.5 text-xs text-slate-500">
                    ObservaÃ§Ãµes
                    <textarea
                      className={`${inputClassName} min-h-20 resize-y py-3`}
                      value={form.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                      placeholder="Ex.: entrega paletizada, agendar doca fria..."
                    />
                  </label>
                </>
              )}

              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600 dark:bg-amber-400/15 dark:text-amber-200">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold">AtenÃ§Ã£o sobre lote e validade</p>
                    <p className="mt-1 leading-relaxed text-amber-800/90 dark:text-amber-100/80">
                      O recebimento pode ser enviado sem lote e validade. PorÃ©m, quando os produtos exigirem
                      esse controle e as informaÃ§Ãµes nÃ£o vierem no XML ou na solicitaÃ§Ã£o, a equipe operacional
                      poderÃ¡ tratar o preenchimento manualmente, gerando possÃ­vel custo adicional na prÃ³xima
                      fatura.
                    </p>
                  </div>
                </div>
              </div>

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
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-800 transition duration-200 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 hover:shadow-lg hover:shadow-violet-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-violet-400/50 dark:hover:bg-violet-500/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={saving}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-wait disabled:translate-y-0 disabled:opacity-60"
              >
                <span className="text-lg leading-none">â†’</span>
                {saving ? <MobileButtonSpinner /> : "Enviar solicitaÃ§Ã£o"}
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 hover:shadow-lg hover:shadow-violet-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-violet-400/50 dark:hover:bg-violet-500/10 dark:hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4.5 overflow-y-auto px-6 py-6">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {selected.supplier ?? "Fornecedor nÃ£o informado"}
                </span>
                <span className="text-[12.5px] text-slate-500 dark:text-slate-400">
                  NF-e {selected.noteNumber || "-"} Â·{" "}
                  {selected.volumeCount ?? 0} {selected.volumeCount === 1 ? "vol." : "vols."}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Data prevista</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selected.eta ?? "-"}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">HorÃ¡rio previsto</span>
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
                      const isDivergent = item.status === "Divergência (Quarentena)", QUARENTENA_CORRIGIDA: "Quarentena Corrigida";
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
                {divergenceError ? (
                  <p className="mb-3 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                    {divergenceError}
                  </p>
                ) : null}
                {selected.status === "Divergência (Quarentena)", QUARENTENA_CORRIGIDA: "Quarentena Corrigida" ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 text-center">
                      Recebimento com divergÃªncia fÃ­sica. Anexe a nova NF-e (XML) corrigida.
                    </p>
                    <label
                      className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 ${uploadingDivergenceXml ? "cursor-wait opacity-60" : ""}`}
                    >
                      {uploadingDivergenceXml ? (
                        <MobileButtonSpinner size={20} />
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Anexar XML Corrigido</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".xml"
                        className="hidden"
                        disabled={uploadingDivergenceXml}
                        onChange={submitDivergenceXml}
                      />
                    </label>
                  </div>
                ) : (selected.status === "AGUARDANDO" || selected.status === "RASCUNHO") &&
                !selected.items.some((item) => item.received > 0) ? (
                  <button
                    type="button"
                    onClick={cancelOrder}
                    disabled={cancelling}
                    className="h-11 w-full rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {cancelling ? <MobileButtonSpinner size={20} /> : "Cancelar solicitaÃ§Ã£o"}
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Este recebimento jÃ¡ estÃ¡ em andamento no CD e nÃ£o pode mais ser cancelado por aqui.
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
