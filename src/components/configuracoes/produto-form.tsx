/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  Barcode, Camera, CameraOff, Check, Plus, Trash2, Upload,
  Box, Calendar, Package, Tag, Archive, ShieldCheck, Layers, DollarSign
} from "lucide-react";
import { saveProdutoAction, deleteProdutoAction } from "@/app/(dashboard)/configuracoes/produtos/actions";
import { Button } from "@/components/ui/button";
import type { ProductKitComponentDraft, ProductKitComponentOption } from "@/lib/product-kits";
import { cn } from "@/lib/utils";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

type DepositanteOption = { id: string; nome: string };

type ProdutoFormProps = {
  depositantes: DepositanteOption[];
  productOptions: ProductKitComponentOption[];
  productKitEnabled?: boolean;
  compactMode?: boolean;
  returnPath?: string;
  defaultValues?: {
    id?: string;
    depositanteId?: string;
    codigoInterno?: string;
    sku?: string;
    nome?: string;
    eanGtin?: string;
    categoria?: string;
    fornecedor?: string;
    tipoProduto?: "SIMPLES" | "KIT";
    metodoRetirada?: "FEFO" | "FIFO" | "LIFO";
    unidadeEstocagem?: "UNIDADE" | "CAIXA" | "PACK" | "PALLET";
    quantidadePorEmbalagem?: number | null;
    imagemPrincipalUrl?: string | null;
    imagemPrincipalStoragePath?: string | null;
    exigeLote?: boolean;
    exigeValidade?: boolean;
    ativo?: boolean;
    descricao?: string;
    pesoKg?: number | null;
    alturaCm?: number | null;
    larguraCm?: number | null;
    comprimentoCm?: number | null;
    qtdMinima?: number | null;
    qtdMaxima?: number | null;
    pontoReposicao?: number | null;
    custoReposicao?: number | null;
    kitComponents?: ProductKitComponentDraft[];
  };
};

export function ProdutoForm({
  depositantes,
  productOptions,
  productKitEnabled = false,
  returnPath,
  defaultValues,
}: ProdutoFormProps) {
  const initialState = { success: false, message: null };
  const [state, formAction, isPending] = useActionState(saveProdutoAction, initialState);

  const [eanGtinValue, setEanGtinValue] = useState(defaultValues?.eanGtin ?? "");
  const [imagePreviewUrl, setImagePreviewUrl] = useState(defaultValues?.imagemPrincipalUrl?.trim() ?? "");
  const [removeImage, setRemoveImage] = useState(false);
  const [depositanteId, setDepositanteId] = useState(defaultValues?.depositanteId ?? (depositantes.length === 1 ? depositantes[0]?.id ?? "" : ""));
  const [nome, setNome] = useState(defaultValues?.nome ?? "");
  const [fornecedor, setFornecedor] = useState(defaultValues?.fornecedor ?? "");
  const [descricao, setDescricao] = useState(defaultValues?.descricao ?? "");
  const [pesoKg, setPesoKg] = useState(defaultValues?.pesoKg?.toString() ?? "");
  const [alturaCm, setAlturaCm] = useState(defaultValues?.alturaCm?.toString() ?? "");
  const [larguraCm, setLarguraCm] = useState(defaultValues?.larguraCm?.toString() ?? "");
  const [comprimentoCm, setComprimentoCm] = useState(defaultValues?.comprimentoCm?.toString() ?? "");
  const [qtdMinima, setQtdMinima] = useState(defaultValues?.qtdMinima?.toString() ?? "");
  const [qtdMaxima, setQtdMaxima] = useState(defaultValues?.qtdMaxima?.toString() ?? "");
  const [pontoReposicao, setPontoReposicao] = useState(defaultValues?.pontoReposicao?.toString() ?? "");
  const [custoReposicao, setCustoReposicao] = useState(defaultValues?.custoReposicao?.toString() ?? "");
  const [sku, setSku] = useState(defaultValues?.sku ?? "");
  const [codigoInterno, setCodigoInterno] = useState(defaultValues?.codigoInterno ?? "");
  
  const [categoria, setCategoria] = useState(defaultValues?.categoria ?? "Seco / Ambiente");
  const [metodoRetirada, setMetodoRetirada] = useState<"FEFO" | "FIFO" | "LIFO">(defaultValues?.metodoRetirada ?? "FEFO");
  const [unidadeEstocagem, setUnidadeEstocagem] = useState<"UNIDADE" | "CAIXA" | "PACK" | "PALLET">(defaultValues?.unidadeEstocagem ?? "UNIDADE");
  const [quantidadePorEmbalagem, setQuantidadePorEmbalagem] = useState(defaultValues?.quantidadePorEmbalagem?.toString() ?? "");
  
  const [exigeLote, setExigeLote] = useState(defaultValues?.exigeLote ?? false);
  const [exigeValidade, setExigeValidade] = useState(defaultValues?.exigeValidade ?? false);
  const [ativo, setAtivo] = useState(defaultValues?.ativo ?? true);
  const [activeStep, setActiveStep] = useState('ident');
  
  const eanInputRef = useRef<HTMLInputElement | null>(null);

  const [tipoProduto, setTipoProduto] = useState<"SIMPLES" | "KIT">(defaultValues?.tipoProduto ?? "SIMPLES");
  const buildKitRows = (drafts?: ProductKitComponentDraft[]) => {
    if (!drafts || drafts.length === 0) return [];
    return drafts.map((d, i) => ({ ...d, key: `init-${i}` }));
  };
  const [kitComponents, setKitComponents] = useState<Array<ProductKitComponentDraft & { key: string }>>(
    buildKitRows(defaultValues?.kitComponents)
  );

  const filteredProductOptions = useMemo(
    () =>
      productOptions.filter(
        (item) =>
          (!depositanteId || item.depositanteId === depositanteId) &&
          (!defaultValues?.id || item.id !== defaultValues.id),
      ),
    [defaultValues, depositanteId, productOptions],
  );

  const isUnit = unidadeEstocagem === "UNIDADE";
  const hasCurrentImage = Boolean(imagePreviewUrl);

  const { videoRef, cameraSupported, cameraEnabled, toggleCamera } = useCameraBarcodeScanner({
    onDetected: (code) => {
      setEanGtinValue(code);
      requestAnimationFrame(() => {
        eanInputRef.current?.focus();
        eanInputRef.current?.select();
      });
    },
  });

  const catDefs: Record<string, string> = {
    'Seco / Ambiente': '#3B82F6', 'Refrigerado': '#06B6D4', 'Congelado': '#6366F1',
    'Frágil': '#EC4899', 'Perigoso (DG)': '#EF4444', 'Alto Valor': '#F59E0B', 'Volumoso': '#10B981'
  };

  const hex2 = (h: string, a: number) => {
    if (!h) return "transparent";
    const n = parseInt(h.slice(1), 16);
    return 'rgba(' + (n>>16&255) + ',' + (n>>8&255) + ',' + (n&255) + ',' + a + ')';
  };

  const steps = [
    { n: '1', label: 'Identificação', key: 'ident' },
    { n: '2', label: 'Logística', key: 'log' },
    { n: '3', label: 'Custos', key: 'cost' },
    { n: '4', label: 'Controles', key: 'ctrl' }
  ];

  const catColor = catDefs[categoria] || '#64748B';
  const ownerName = depositantes.find(d => d.id === depositanteId)?.nome || 'Depositante';
  
  const handleScrollTo = (key: string) => {
    setActiveStep(key);
    const el = document.getElementById(key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <form action={formAction} className="flex flex-col flex-1 h-full w-full">
      <input type="hidden" name="id" value={defaultValues?.id ?? ""} />
      <input type="hidden" name="returnPath" value={returnPath ?? ""} />
      <input type="hidden" name="removeImage" value={removeImage ? "true" : "false"} />
      <input type="hidden" name="fornecedor" value={fornecedor} />
      <input
        type="hidden"
        name="currentImageUrl"
        value={defaultValues?.imagemPrincipalUrl ?? ""}
      />
      <input
        type="hidden"
        name="currentImageStoragePath"
        value={defaultValues?.imagemPrincipalStoragePath ?? ""}
      />
      <input type="hidden" name="categoria" value={categoria} />
      <input type="hidden" name="metodoRetirada" value={metodoRetirada} />
      <input type="hidden" name="unidadeEstocagem" value={unidadeEstocagem} />
      <input type="hidden" name="exigeLote" value={exigeLote ? "true" : "false"} />
      <input type="hidden" name="exigeValidade" value={exigeValidade ? "true" : "false"} />
      <input type="hidden" name="ativo" value={ativo ? "true" : "false"} />
      <input type="hidden" name="descricao" value={descricao} />
      <input type="hidden" name="pesoKg" value={pesoKg} />
      <input type="hidden" name="alturaCm" value={alturaCm} />
      <input type="hidden" name="larguraCm" value={larguraCm} />
      <input type="hidden" name="comprimentoCm" value={comprimentoCm} />
      <input type="hidden" name="qtdMinima" value={qtdMinima} />
      <input type="hidden" name="qtdMaxima" value={qtdMaxima} />
      <input type="hidden" name="pontoReposicao" value={pontoReposicao} />
      <input type="hidden" name="custoReposicao" value={custoReposicao} />

      <input type="hidden" name="tipoProduto" value={tipoProduto} />
      {tipoProduto === "KIT" &&
        kitComponents.map((comp, i) => (
          <div key={comp.key}>
            <input type="hidden" name={`kitComponents[${i}].componentProductId`} value={comp.componentProductId} />
            <input type="hidden" name={`kitComponents[${i}].quantity`} value={comp.quantity} />
          </div>
        ))}

      {state.message && (
        <div className={cn("mb-6 rounded-xl p-4 text-sm font-medium", state.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
          {state.message}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col gap-6 mb-8 mt-2">
        <div className="flex items-center gap-3">
          <a href={returnPath || "/configuracoes/produtos"} className="inline-flex items-center justify-center h-[40px] px-4 rounded-[12px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] font-bold text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm">
            <span className="mr-1.5 text-slate-500 font-normal">‹</span> Produtos
          </a>
          <div className="flex items-center gap-2 text-[14px] ml-1">
            <span className="text-slate-500">Produtos</span>
            <span className="text-slate-300 text-[12px]">›</span>
            <span className="text-slate-900 dark:text-slate-100 font-medium">{defaultValues?.id ? "Editar" : "Novo"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className={cn(spaceGrotesk.className, "m-0 text-[32px] font-bold text-[#111827] dark:text-white leading-tight")}>
            {defaultValues?.id ? "Editar produto" : "Cadastrar novo produto"}
          </h1>
          <p className="m-0 text-[15px] text-slate-500">
            Preencha as informações do SKU. Os campos marcados com <span className="text-rose-500 font-bold">*</span> são obrigatórios.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {steps.map((s, i) => {
          const isActive = activeStep === s.key;
          return (
            <button key={s.key} type="button" onClick={() => handleScrollTo(s.key)} 
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 rounded-full cursor-pointer transition-all border",
                isActive 
                  ? "bg-[#F3E8FF] border-transparent dark:bg-violet-900/40" 
                  : "bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-950 dark:border-slate-800 dark:hover:border-slate-700 shadow-sm"
              )}
            >
              <span className={cn(
                spaceGrotesk.className, 
                "w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13.5px] font-bold shadow-sm",
                isActive 
                  ? "bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-white" 
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              )}>
                {s.n}
              </span>
              <span className={cn(
                "text-[14.5px] font-bold",
                isActive ? "text-[#6D28D9] dark:text-violet-300" : "text-[#4B5563] dark:text-slate-400"
              )}>{s.label}</span>
            </button>
          );
        })}
        {defaultValues?.id && (
          <button
            formAction={deleteProdutoAction}
            type="submit"
            title="Excluir Produto"
            className="w-[42px] h-[42px] ml-1 rounded-full flex items-center justify-center border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm bg-white dark:bg-slate-950 dark:border-rose-900/50 dark:hover:bg-rose-900/20"
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 pb-32">
        
        {/* FORM COLUMN */}
        <div className="flex flex-col gap-5 min-w-0">
          
          {/* Identificação */}
          <div id="ident" className="rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden scroll-mt-4">
            <div className="flex items-center gap-3 py-4 px-5 border-b border-slate-100 dark:border-slate-800">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500"><Tag className="w-4 h-4"/></span>
              <div className="flex flex-col">
                <span className={cn(spaceGrotesk.className, "text-[15.5px] font-bold text-slate-900 dark:text-slate-100")}>Identificação</span>
                <span className="text-[12.5px] text-slate-500">Nome, códigos, depositante e categoria</span>
              </div>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-bold text-slate-500">Nome do produto <span className="text-rose-500">*</span></span>
                <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all">
                  <input name="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Ração Golden Formula Cães Adultos 15kg" 
                    className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                </div>
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">SKU <span className="text-rose-500">*</span></span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all">
                    <input name="sku" value={sku} onChange={e => setSku(e.target.value)} placeholder="GLD-15KG-AD" 
                      className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Cód. Interno</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all">
                    <input name="codigoInterno" value={codigoInterno} onChange={e => setCodigoInterno(e.target.value)} placeholder="Opcional" 
                      className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">EAN / GTIN</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all">
                    <Barcode className="w-4 h-4 text-slate-400 mr-2" />
                    <input ref={eanInputRef} name="eanGtin" value={eanGtinValue} onChange={e => setEanGtinValue(e.target.value)} placeholder="0000000000000" 
                      className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                    {cameraSupported && (
                      <button type="button" onClick={toggleCamera} className={cn("ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors", cameraEnabled && "text-violet-600 bg-violet-100")}>
                        {cameraEnabled ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </label>
              </div>

              {cameraEnabled && (
                <div className="w-full max-w-[300px] h-[200px] rounded-xl overflow-hidden bg-slate-900 relative">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-2 border-dashed border-white/50 m-6 rounded-lg pointer-events-none" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Depositante <span className="text-rose-500">*</span></span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all">
                    <select name="depositanteId" value={depositanteId} onChange={e => setDepositanteId(e.target.value)} 
                      className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium cursor-pointer w-full")}>
                      <option value="">Selecione...</option>
                      {depositantes.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                  </div>
                </label>
              </div>

              <div className="flex flex-col gap-2.5 mt-2">
                <span className="text-[13px] font-bold text-slate-500">Categoria operacional <span className="text-rose-500">*</span></span>
                <div className="flex gap-2.5 flex-wrap">
                  {Object.keys(catDefs).map(cat => (
                    <button key={cat} type="button" onClick={() => setCategoria(cat)}
                      className={cn("h-[38px] px-3.5 rounded-xl font-bold text-[13px] cursor-pointer flex items-center gap-2 transition-all border-2",
                        categoria === cat ? "" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                      style={categoria === cat ? { borderColor: catDefs[cat], background: hex2(catDefs[cat], 0.14), color: catDefs[cat] } : undefined}
                    >
                      <span className="w-2 h-2 rounded-full" style={{background: catDefs[cat]}} />
                      {cat}
                    </button>
                  ))}
                  <div className="flex items-center h-[38px] px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input value={Object.keys(catDefs).includes(categoria) ? "" : categoria} onChange={e => setCategoria(e.target.value)} placeholder="Outra..." 
                      className="w-[100px] border-none outline-none bg-transparent text-[13px] font-bold" />
                  </div>
                </div>
              </div>
              
              {/* Descrição */}
              <div className="flex flex-col gap-2.5 mt-4">
                <span className="text-[13px] font-bold text-slate-500">Descrição do produto</span>
                <textarea 
                  value={descricao} 
                  onChange={e => setDescricao(e.target.value)} 
                  placeholder="Informações adicionais do produto..."
                  className={cn(spaceGrotesk.className, "w-full min-h-[100px] p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all outline-none resize-y text-[14px] font-medium")}
                />
              </div>

            </div>
          </div>

          {/* Logística */}
          <div id="log" className="rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden scroll-mt-4">
            <div className="flex items-center gap-3 py-4 px-5 border-b border-slate-100 dark:border-slate-800">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-500"><Box className="w-4 h-4"/></span>
              <div className="flex flex-col">
                <span className={cn(spaceGrotesk.className, "text-[15.5px] font-bold text-slate-900 dark:text-slate-100")}>Logística & estocagem</span>
                <span className="text-[12.5px] text-slate-500">Dimensões, método de entrada e unidade de manuseio</span>
              </div>
            </div>
            
            <div className="p-5 flex flex-col gap-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Largura</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input type="number" step="0.01" value={larguraCm} onChange={e => setLarguraCm(e.target.value)} placeholder="0" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                    <span className="text-[12px] text-slate-400">cm</span>
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Altura</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input type="number" step="0.01" value={alturaCm} onChange={e => setAlturaCm(e.target.value)} placeholder="0" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                    <span className="text-[12px] text-slate-400">cm</span>
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Profund.</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input type="number" step="0.01" value={comprimentoCm} onChange={e => setComprimentoCm(e.target.value)} placeholder="0" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                    <span className="text-[12px] text-slate-400">cm</span>
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Peso</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input type="number" step="0.001" value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="0" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                    <span className="text-[12px] text-slate-400">kg</span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-bold text-slate-500">Método de entrada <span className="text-rose-500">*</span></span>
                <div className="flex gap-2 flex-wrap">
                  {["FEFO", "FIFO", "LIFO"].map(m => (
                    <button key={m} type="button" onClick={() => setMetodoRetirada(m as "FEFO" | "FIFO" | "LIFO")}
                      className={cn(spaceGrotesk.className, "h-[42px] px-4 rounded-xl font-bold text-[13.5px] cursor-pointer transition-all border-2",
                        metodoRetirada === m ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2.5">
                  <span className="text-[13px] font-bold text-slate-500">Método de estocagem <span className="text-rose-500">*</span></span>
                  <div className="flex gap-2 flex-wrap">
                    {["UNIDADE", "CAIXA", "PACK", "PALLET"].map(u => (
                      <button key={u} type="button" onClick={() => setUnidadeEstocagem(u as "UNIDADE" | "CAIXA" | "PACK" | "PALLET")}
                        className={cn("h-[42px] px-4 rounded-xl font-bold text-[13px] cursor-pointer transition-all border-2",
                          unidadeEstocagem === u ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {u.charAt(0) + u.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-2.5" style={{ opacity: isUnit ? 0.5 : 1 }}>
                  <span className="text-[13px] font-bold text-slate-500">{isUnit ? 'Qtd. por embalagem' : 'Qtd. por ' + unidadeEstocagem.toLowerCase()}</span>
                  <div className={cn("flex items-center h-[42px] px-3 rounded-xl border-2 focus-within:border-violet-500",
                       isUnit ? "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                  )}>
                    <input name="quantidadePorEmbalagem" value={quantidadePorEmbalagem} onChange={e => setQuantidadePorEmbalagem(e.target.value)}
                      placeholder={isUnit ? 'N/A p/ unidade' : 'Ex: 12'} disabled={isUnit}
                      className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Estoque mínimo</span>
                  <div className="flex items-center h-[42px] px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input type="number" step="0.001" value={qtdMinima} onChange={e => setQtdMinima(e.target.value)} placeholder="0" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Estoque máximo</span>
                  <div className="flex items-center h-[42px] px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input type="number" step="0.001" value={qtdMaxima} onChange={e => setQtdMaxima(e.target.value)} placeholder="0" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Ponto de reposição</span>
                  <div className="flex items-center h-[42px] px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <input type="number" step="0.001" value={pontoReposicao} onChange={e => setPontoReposicao(e.target.value)} placeholder="0" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Custos (Visual Only for now) */}
          <div id="cost" className="rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden scroll-mt-4">
            <div className="flex items-center gap-3 py-4 px-5 border-b border-slate-100 dark:border-slate-800">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-500"><DollarSign className="w-4 h-4"/></span>
              <div className="flex flex-col">
                <span className={cn(spaceGrotesk.className, "text-[15.5px] font-bold text-slate-900 dark:text-slate-100")}>Custos & Fornecimento</span>
                <span className="text-[12.5px] text-slate-500">Valor base para relatórios e ressuprimento</span>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
               <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Fornecedor principal</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input 
                      placeholder="Nome da empresa" 
                      value={fornecedor}
                      onChange={(e) => setFornecedor(e.target.value)}
                      className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} 
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold text-slate-500">Custo de reposição (R$)</span>
                  <div className="flex items-center h-12 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-within:border-violet-500">
                    <span className="text-[14px] text-slate-400 mr-2 font-bold">R$</span>
                    <input type="number" step="0.01" value={custoReposicao} onChange={e => setCustoReposicao(e.target.value)} placeholder="0,00" className={cn(spaceGrotesk.className, "flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] font-medium")} />
                  </div>
                </label>
            </div>
          </div>

          {/* Controles */}
          <div id="ctrl" className="rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden scroll-mt-4">
            <div className="flex items-center gap-3 py-4 px-5 border-b border-slate-100 dark:border-slate-800">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-teal-500/10 text-teal-500"><ShieldCheck className="w-4 h-4"/></span>
              <div className="flex flex-col">
                <span className={cn(spaceGrotesk.className, "text-[15.5px] font-bold text-slate-900 dark:text-slate-100")}>Controles de operação</span>
                <span className="text-[12.5px] text-slate-500">Lote, validade e status do SKU</span>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button type="button" onClick={() => setExigeValidade(!exigeValidade)}
                  className={cn("flex items-start gap-3.5 p-4 rounded-[14px] border-2 text-left cursor-pointer transition-all",
                    exigeValidade ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                  )}
                >
                  <span className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", exigeValidade ? "bg-violet-500/20 text-violet-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}><Calendar className="w-5 h-5"/></span>
                  <div className="flex flex-col flex-1 gap-1">
                    <span className="text-[14px] font-bold text-slate-900 dark:text-slate-100">Controle de validade</span>
                    <span className="text-[12px] text-slate-500 leading-snug">Exige data de vencimento em cada entrada e aplica giro FEFO.</span>
                  </div>
                  <div className={cn("w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center", exigeValidade ? "border-violet-500 bg-violet-500" : "border-slate-200 dark:border-slate-700 bg-transparent")}>
                    {exigeValidade && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>

                <button type="button" onClick={() => setExigeLote(!exigeLote)}
                  className={cn("flex items-start gap-3.5 p-4 rounded-[14px] border-2 text-left cursor-pointer transition-all",
                    exigeLote ? "border-violet-500 bg-violet-500/10" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                  )}
                >
                  <span className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", exigeLote ? "bg-violet-500/20 text-violet-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}><Layers className="w-5 h-5"/></span>
                  <div className="flex flex-col flex-1 gap-1">
                    <span className="text-[14px] font-bold text-slate-900 dark:text-slate-100">Controle de lote</span>
                    <span className="text-[12px] text-slate-500 leading-snug">Rastreia nº de lote para recall e rastreabilidade completa.</span>
                  </div>
                  <div className={cn("w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center", exigeLote ? "border-violet-500 bg-violet-500" : "border-slate-200 dark:border-slate-700 bg-transparent")}>
                    {exigeLote && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              </div>

              <div className="h-[1px] bg-slate-200 dark:bg-slate-800 my-1" />

              <div className={cn("flex items-center justify-between p-4 rounded-[14px] border-2", ativo ? "border-transparent bg-emerald-500/10" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900")}>
                <div className="flex items-center gap-3.5">
                  <span className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", ativo ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}><Archive className="w-5 h-5"/></span>
                  <div className="flex flex-col">
                    <span className="text-[14.5px] font-bold text-slate-900 dark:text-slate-100">Status: {ativo ? 'Ativo' : 'Inativo'}</span>
                    <span className="text-[12.5px] text-slate-500">{ativo ? 'Disponível para recebimento, picking e venda.' : 'Oculto das operações - não recebe nem separa.'}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setAtivo(!ativo)} className={cn("relative w-[52px] h-[30px] rounded-full transition-all", ativo ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-slate-200 dark:bg-slate-700")}>
                  <span className="absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-white shadow-sm transition-all" style={{ transform: ativo ? 'translateX(22px)' : 'translateX(0)' }} />
                </button>
              </div>
            </div>
          </div>

          {/* Kits (Composição) */}
          {productKitEnabled && (
            <div id="kit" className="rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden scroll-mt-4">
              <div className="flex items-center gap-3 py-4 px-5 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-500"><Layers className="w-4 h-4"/></span>
                <div className="flex flex-col flex-1">
                  <span className={cn(spaceGrotesk.className, "text-[15.5px] font-bold text-slate-900 dark:text-slate-100")}>Composição (Kit)</span>
                  <span className="text-[12.5px] text-slate-500">Agrupe vários SKUs para formar um novo produto</span>
                </div>
                <div className="flex items-center gap-2">
                   <button type="button" onClick={() => setTipoProduto("SIMPLES")} className={cn("px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all", tipoProduto === "SIMPLES" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>Simples</button>
                   <button type="button" onClick={() => setTipoProduto("KIT")} className={cn("px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all", tipoProduto === "KIT" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>Produto Kit</button>
                </div>
              </div>
              
              {tipoProduto === "KIT" && (
                <div className="p-5 flex flex-col gap-4 bg-indigo-50/30 dark:bg-indigo-900/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400">SKUs que compõem este kit</span>
                    <button type="button" onClick={() => setKitComponents(c => [...c, { key: `comp-${Date.now()}`, componentProductId: "", quantity: 1 }])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[12.5px] font-bold text-indigo-600 hover:border-indigo-300 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Adicionar SKU
                    </button>
                  </div>
                  
                  {kitComponents.length === 0 && (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <span className="text-[13px] font-bold text-slate-400">Nenhum componente adicionado.</span>
                    </div>
                  )}

                  {kitComponents.map((comp, idx) => (
                    <div key={comp.key} className="flex gap-3 items-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SKU Componente {idx + 1}</span>
                        <select value={comp.componentProductId} onChange={e => setKitComponents(c => c.map((x, i) => i === idx ? { ...x, componentProductId: e.target.value } : x))}
                          className={cn(spaceGrotesk.className, "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-10 px-3 rounded-xl text-[13.5px] font-bold outline-none focus:border-indigo-500")}>
                          <option value="">Selecione o produto...</option>
                          {filteredProductOptions.map(o => <option key={o.id} value={o.id}>{o.codigoInterno ? `[${o.codigoInterno}] ` : ""}{o.nome}</option>)}
                        </select>
                      </div>
                      <div className="w-[100px] flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qtd</span>
                        <input type="number" min="1" value={comp.quantity} onChange={e => setKitComponents(c => c.map((x, i) => i === idx ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))}
                          className={cn(spaceGrotesk.className, "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-10 px-3 rounded-xl text-[14px] font-bold outline-none focus:border-indigo-500")} />
                      </div>
                      <div className="pt-5">
                        <button type="button" onClick={() => setKitComponents(c => c.filter((_, i) => i !== idx))}
                          className="w-10 h-10 flex items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* FIM DA COLUNA FORM */}
        </div>

        {/* PREVIEW COLUMN */}
        <div className="w-full shrink-0 sticky top-6 self-start flex flex-col gap-4">
            <span className="text-[12px] font-bold text-slate-500 tracking-wider uppercase mb-[-4px]">PRÉ-VISUALIZAÇÃO</span>
          
          <div className="rounded-[20px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
            <div className="relative h-[180px] flex flex-col items-center justify-center transition-all group" 
                 style={{ background: '#74A0F1' }}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 1px, transparent 1px 12px)' }} />
              
              {hasCurrentImage ? (
                 <img src={imagePreviewUrl} alt="Product preview" className="relative z-10 w-full h-full object-cover" />
              ) : (
                <div className="relative z-10 flex flex-col items-center justify-center text-slate-600/70">
                  <svg className="w-8 h-8 mb-2 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[13px] font-medium text-slate-700">Arraste a foto do produto</span>
                  <span className="text-[12px] text-slate-600 mt-0.5">or <span className="underline cursor-pointer">browse files</span></span>
                </div>
              )}
              
              <label className="absolute inset-0 z-20 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                <div className="w-10 h-10 rounded-xl bg-black/40 text-white flex items-center justify-center shadow-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <input type="file" name="imageFile" className="hidden" accept="image/png, image/jpeg, image/webp" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImagePreviewUrl(URL.createObjectURL(e.target.files[0]));
                      setRemoveImage(false);
                    }
                  }} 
                />
              </label>

              <div className="absolute top-4 right-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-bold text-white shadow-sm backdrop-blur-md"
                      style={{ background: ativo ? '#10B981' : 'rgba(100,116,139,0.9)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  {ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>

            <div className="p-5 flex flex-col bg-white dark:bg-slate-950">
              <div className="flex gap-2 flex-wrap mb-4">
                <span className="px-3 py-1 rounded-full text-[11.5px] font-bold" style={{ backgroundColor: hex2(catColor, 0.15), color: catColor }}>
                  {categoria || 'Seco / Ambiente'}
                </span>
                <span className="px-3 py-1 rounded-full text-[11.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {metodoRetirada || 'FEFO'}
                </span>
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <span className={cn(spaceGrotesk.className, "text-[18px] font-bold leading-tight text-slate-900 dark:text-slate-100")}>{nome || 'Nome do produto'}</span>
                <span className={cn(spaceGrotesk.className, "text-[12.5px] text-slate-500")}>{sku || 'SKU-0000'}</span>
              </div>

              <div className="flex gap-2 flex-wrap mb-5">
                {exigeValidade && (
                  <span className="px-2.5 py-1 rounded-md text-[11.5px] font-bold flex items-center gap-1 bg-amber-500/15 text-amber-600">
                    <Calendar className="w-3 h-3"/> Validade
                  </span>
                )}
                {exigeLote && (
                  <span className="px-2.5 py-1 rounded-md text-[11.5px] font-bold flex items-center gap-1 bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <Layers className="w-3 h-3"/> Lote
                  </span>
                )}
              </div>

              <hr className="border-t border-slate-100 dark:border-slate-800 mb-4" />

              <div className="flex items-center justify-between">
                <span className={cn(spaceGrotesk.className, "text-[16px] font-bold text-slate-900 dark:text-slate-100")}>
                  Custo {custoReposicao && parseFloat(custoReposicao) > 0 ? `R$ ${parseFloat(custoReposicao).toFixed(2).replace('.', ',')}` : <span className="text-slate-300 dark:text-slate-700 ml-1">—</span>}
                </span>
                <span className="text-[12.5px] text-slate-500">
                  {isUnit ? 'Unidade' : `${unidadeEstocagem}`}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 p-5 rounded-[20px] bg-white dark:bg-slate-950 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className={cn(spaceGrotesk.className, "text-[15px] font-bold text-slate-900 dark:text-slate-100")}>Preenchimento</span>
              <span className={cn(spaceGrotesk.className, "text-[14px] font-bold text-slate-900 dark:text-slate-100")}>
                {Math.round([!!nome, !!sku, !!depositanteId, !!categoria, isUnit || !!quantidadePorEmbalagem].filter(Boolean).length / 5 * 100)}%
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="h-1.5 w-full bg-slate-100 rounded-full mb-5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" 
                   style={{ width: `${Math.round([!!nome, !!sku, !!depositanteId, !!categoria, isUnit || !!quantidadePorEmbalagem].filter(Boolean).length / 5 * 100)}%` }} />
            </div>
            
            <div className="flex flex-col gap-3">
              {[
                { label: 'Nome preenchido', ok: !!nome },
                { label: 'SKU definido', ok: !!sku },
                { label: 'Depositante informado', ok: !!depositanteId },
                { label: 'Método de estocagem', ok: isUnit || !!quantidadePorEmbalagem },
                { label: 'Dimensões e peso', ok: false } /* Mock based on screenshot */
              ].map((c, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={cn("w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 transition-colors", 
                    c.ok ? "bg-emerald-100 text-emerald-500" : "bg-slate-50")}>
                    {c.ok && (
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={cn("text-[13.5px]", c.ok ? "text-slate-700 dark:text-slate-300" : "text-slate-400")}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer Actions */}
      <div className="fixed bottom-0 right-0 z-50 w-full lg:w-[calc(100vw-var(--sidebar-width,288px))] flex items-center gap-4 px-6 py-4 sm:py-5 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.05)] flex-wrap">
        <span className="text-[13px] text-slate-400 hidden sm:block">Rascunho salvo automaticamente</span>
        <div className="flex-1" />
        <a href={returnPath || "/configuracoes/produtos"} className={cn(spaceGrotesk.className, "h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-[14px] flex items-center justify-center hover:border-violet-500 transition-colors shadow-sm")}>
          Cancelar
        </a>
        <button type="button" className={cn(spaceGrotesk.className, "h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-[14px] flex items-center justify-center hover:border-violet-500 transition-colors shadow-sm")}>
          Salvar rascunho
        </button>
        <Button type="submit" disabled={isPending} className={cn(spaceGrotesk.className, "h-11 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold shadow-lg shadow-violet-500/30 hover:-translate-y-[1px] transition-all")}>
          <Check className="w-4 h-4 mr-2" />
          {isPending
            ? "Salvando..."
            : defaultValues?.id
              ? "Salvar alterações"
              : "Cadastrar produto"}
        </Button>
      </div>

    </form>
  );
}
