"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Camera, CameraOff, Focus, Search, Volume2 } from "lucide-react";
import type { ReceivingOrderDetail } from "@/lib/receiving";

type AddressOption = {
  id: string;
  codigo: string;
  area: string;
};

type ReceivingConferencePanelProps = {
  orderId: string;
  initialItems: ReceivingOrderDetail["items"];
  addresses: AddressOption[];
};

type ConferenceItemState = {
  id: string;
  sku: string;
  description: string;
  barcode: string;
  internalCode: string;
  unitCode: string;
  unitLabel: string;
  expectedQuantity: number;
  receivedQuantity: string;
  lotValue: string;
  expiryValue: string;
  requireLot: boolean;
  requireExpiry: boolean;
  status: string;
};

type ScanFeedbackTone = "success" | "error";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

export function ReceivingConferencePanel({
  orderId,
  initialItems,
  addresses,
}: ReceivingConferencePanelProps) {
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const cameraLoopRef = useRef<number | null>(null);
  const lastCameraCodeRef = useRef<string>("");
  const lastCameraAtRef = useRef<number>(0);
  const [items, setItems] = useState<ConferenceItemState[]>(
    initialItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      description: item.description,
      barcode: item.barcode,
      internalCode: item.internalCode,
      unitCode: item.unitCode,
      unitLabel: item.unitLabel,
      expectedQuantity: item.expectedQuantity,
      receivedQuantity: String(item.receivedQuantity || ""),
      lotValue: item.lotValue,
      expiryValue: item.expiryValue,
      requireLot: item.requireLot,
      requireExpiry: item.requireExpiry,
      status: item.status,
    })),
  );
  const [enderecoId, setEnderecoId] = useState(addresses[0]?.id ?? "");
  const [scanValue, setScanValue] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanMessageTone, setScanMessageTone] = useState<ScanFeedbackTone>("success");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [operatorMode, setOperatorMode] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const cameraSupported =
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    !!navigator.mediaDevices?.getUserMedia;

  const progress = useMemo(() => {
    const expected = items.reduce((sum, item) => sum + Number(item.expectedQuantity || 0), 0);
    const received = items.reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0);

    return { expected, received };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeScanValue(scanValue);

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) =>
      [item.sku, item.description, item.barcode, item.internalCode]
        .filter(Boolean)
        .some((value) => normalizeScanValue(value).includes(normalizedSearch)),
    );
  }, [items, scanValue]);

  useEffect(() => {
    if (cameraSupported) {
      const BarcodeDetectorRef = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;

      if (BarcodeDetectorRef) {
        detectorRef.current = new BarcodeDetectorRef({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
        });
      }
    }
  }, [cameraSupported]);

  useEffect(() => {
    if (!operatorMode) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(focusTimer);
  }, [operatorMode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function updateItem(
    itemId: string,
    field: keyof Pick<ConferenceItemState, "receivedQuantity" | "lotValue" | "expiryValue">,
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
    setError(null);
    setMessage(null);
  }

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function playFeedbackTone(tone: ScanFeedbackTone) {
    if (!soundEnabled || typeof window === "undefined") {
      return;
    }

    const AudioContextRef =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextRef) {
      return;
    }

    const context = new AudioContextRef();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = tone === "success" ? "sine" : "square";
    oscillator.frequency.value = tone === "success" ? 880 : 220;
    gain.gain.value = 0.04;

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (tone === "success" ? 0.08 : 0.16));

    oscillator.onended = () => {
      void context.close();
    };
  }

  function setScanFeedback(text: string, tone: ScanFeedbackTone) {
    setScanMessage(text);
    setScanMessageTone(tone);
    playFeedbackTone(tone);
  }

  function applyScannedCode(rawValue: string) {
    const normalizedScan = normalizeScanValue(rawValue);

    if (!normalizedScan) {
      setScanFeedback("Informe ou leia um código para localizar o item.", "error");
      return false;
    }

    const matchedItem = items.find((item) =>
      [item.barcode, item.internalCode, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScanValue(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      setScanFeedback("Código não encontrado neste recebimento.", "error");
      return false;
    }

    const nextQuantity = Number(matchedItem.receivedQuantity || 0) + 1;

    setItems((current) =>
      current.map((item) =>
        item.id === matchedItem.id
          ? {
              ...item,
              receivedQuantity: String(nextQuantity),
            }
          : item,
      ),
    );

    setActiveItemId(matchedItem.id);
    setScanFeedback(
      `Leitura aplicada em ${matchedItem.sku}. +1 ${matchedItem.unitLabel.toLowerCase()} registrada. Total recebido: ${nextQuantity}.`,
      "success",
    );
    setError(null);
    setMessage(null);
    setScanValue("");

    requestAnimationFrame(() => {
      quantityInputRefs.current[matchedItem.id]?.focus();
      quantityInputRefs.current[matchedItem.id]?.select();

      if (operatorMode) {
        focusScanInput();
      }
    });

    return true;
  }

  function handleScanSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    applyScannedCode(scanValue);
  }

  async function startCamera() {
    if (!cameraSupported || !detectorRef.current) {
      setCameraMessage("Leitura por câmera não suportada neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraEnabled(true);
      setCameraMessage("Câmera ativa. Aponte para o código de barras.");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      runCameraLoop();
    } catch {
      setCameraEnabled(false);
      setCameraMessage("Não foi possível acessar a câmera neste dispositivo.");
    }
  }

  function stopCamera() {
    if (cameraLoopRef.current) {
      window.cancelAnimationFrame(cameraLoopRef.current);
      cameraLoopRef.current = null;
    }

    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraEnabled(false);
  }

  function toggleCamera() {
    if (cameraEnabled) {
      stopCamera();
      setCameraMessage("Leitura por câmera pausada.");
      return;
    }

    void startCamera();
  }

  function runCameraLoop() {
    const loop = async () => {
      if (!cameraEnabled && !cameraStreamRef.current) {
        return;
      }

      const detector = detectorRef.current;
      const video = videoRef.current;

      if (detector && video && video.readyState >= 2) {
        try {
          const results = await detector.detect(video);
          const code = results.find((item) => item.rawValue?.trim())?.rawValue?.trim() ?? "";

          if (code) {
            const now = Date.now();
            if (
              code !== lastCameraCodeRef.current ||
              now - lastCameraAtRef.current > 1600
            ) {
              lastCameraCodeRef.current = code;
              lastCameraAtRef.current = now;
              applyScannedCode(code);
            }
          }
        } catch {
          setCameraMessage("A câmera está ativa, mas a leitura automática falhou neste momento.");
        }
      }

      cameraLoopRef.current = window.requestAnimationFrame(loop);
    };

    cameraLoopRef.current = window.requestAnimationFrame(loop);
  }

  async function submitConference(finalizar: boolean) {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/recebimento/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enderecoId,
          finalizar,
          items: items.map((item) => ({
            id: item.id,
            quantidadeRecebida: Number(item.receivedQuantity || 0),
            lote: item.lotValue || undefined,
            validadeEm: item.expiryValue || undefined,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Não foi possível salvar a conferência.");
        playFeedbackTone("error");
        return;
      }

      setMessage(result.message ?? "Conferência atualizada com sucesso.");
      playFeedbackTone("success");
    } catch {
      setError("Falha de comunicação com a API da conferência.");
      playFeedbackTone("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Conferência operacional</h2>
          <p className="mt-1 text-sm text-slate-600">
            Registre quantidade recebida, lote, validade e conclua a entrada no estoque.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>
            Recebido: <strong className="text-slate-950">{progress.received}</strong>
          </p>
          <p>
            Previsto: <strong className="text-slate-950">{progress.expected}</strong>
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_1.2fr]">
        <label className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">
            Endereço destino para entrada
          </span>
          <select
            value={enderecoId}
            onChange={(event) => setEnderecoId(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          >
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.codigo} - {formatArea(address.area)}
              </option>
            ))}
          </select>
        </label>

        <form onSubmit={handleScanSubmit} className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">
            Leitura de código de barras
          </span>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2">
            <Barcode className="h-4 w-4 text-slate-500" />
            <input
              ref={scanInputRef}
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onBlur={() => {
                if (operatorMode) {
                  window.setTimeout(() => {
                    scanInputRef.current?.focus();
                  }, 40);
                }
              }}
              placeholder="Leia EAN/GTIN, SKU ou código interno"
              className="h-10 w-full border-0 bg-transparent px-1 text-sm text-slate-950 outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Search className="h-4 w-4" />
              Ler
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Funciona com leitor conectado ao teclado: o código entra no campo e o item é localizado automaticamente.
          </p>
          {scanMessage ? (
            <p
              className={`text-sm ${
                scanMessageTone === "success" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {scanMessage}
            </p>
          ) : null}
        </form>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setOperatorMode((current) => !current)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                operatorMode
                  ? "bg-sky-600 text-white hover:bg-sky-700"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {operatorMode ? "Modo operador ativo" : "Ativar modo operador"}
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                soundEnabled
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Volume2 className="h-4 w-4" />
              {soundEnabled ? "Som ativo" : "Ativar som"}
            </button>

            <button
              type="button"
              onClick={focusScanInput}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Focus className="h-4 w-4" />
              Focar leitura
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            No modo operador, o foco volta automaticamente para o campo de leitura após cada conferência.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Leitura por câmera</p>
              <p className="text-sm text-slate-600">
                Use o celular para ler EAN/GTIN com a câmera quando o navegador suportar.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleCamera}
              disabled={!cameraSupported}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {cameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {cameraEnabled ? "Desligar câmera" : "Ligar câmera"}
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[16/9] w-full object-cover"
            />
          </div>

          <p className="mt-3 text-sm text-slate-600">
            {cameraMessage ??
              (cameraSupported
                ? "Câmera disponível para leitura contínua."
                : "Seu navegador atual não oferece leitura por câmera neste modo.")}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl border p-4 transition ${
              activeItemId === item.id
                ? "border-sky-400 bg-sky-50/60 shadow-sm"
                : "border-slate-200"
            }`}
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-slate-950">{item.sku}</p>
                  {activeItemId === item.id ? (
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                      Item lido
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {item.unitLabel}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{item.description}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                  Previsto {item.expectedQuantity.toLocaleString("pt-BR")} • Status {formatStatus(item.status)}
                </p>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p>EAN/GTIN: {item.barcode || "-"}</p>
                  <p>Código interno: {item.internalCode || "-"}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 xl:min-w-[620px]">
                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">
                    Quantidade recebida
                  </span>
                  <input
                    ref={(element) => {
                      quantityInputRefs.current[item.id] = element;
                    }}
                    value={item.receivedQuantity}
                    onChange={(event) =>
                      updateItem(item.id, "receivedQuantity", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">
                    Lote {item.requireLot ? "*" : ""}
                  </span>
                  <input
                    value={item.lotValue}
                    onChange={(event) => updateItem(item.id, "lotValue", event.target.value)}
                    placeholder={item.requireLot ? "Obrigatório" : "Opcional"}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">
                    Validade {item.requireExpiry ? "*" : ""}
                  </span>
                  <input
                    type="date"
                    value={item.expiryValue}
                    onChange={(event) => updateItem(item.id, "expiryValue", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
        {!filteredItems.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum item encontrado para a busca ou leitura atual.
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => submitConference(false)}
          disabled={isSaving || !enderecoId}
          className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Salvando..." : "Salvar conferência"}
        </button>
        <button
          type="button"
          onClick={() => submitConference(true)}
          disabled={isSaving || !enderecoId}
          className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {isSaving ? "Concluindo..." : "Concluir e lançar no estoque"}
        </button>
      </div>
    </div>
  );
}

function formatArea(area: string) {
  switch (area) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Pulmão";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return area;
  }
}

function formatStatus(status: string) {
  switch (status) {
    case "PENDENTE":
      return "Pendente";
    case "EM_CONFERENCIA":
      return "Em conferência";
    case "RECEBIDO":
      return "Recebido";
    case "DIVERGENCIA":
      return "Divergência";
    default:
      return status;
  }
}

function normalizeScanValue(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").trim().toUpperCase();
}
