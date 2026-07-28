"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { savePickingWaveProgressAction, cancelPickingOrderAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import type { ShippingPickingOrder } from "@/lib/shipping-picking";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobileBackButton,
  MobileScanOverlay,
  MobileIcon,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

type WaveItemState = ShippingPickingOrder["items"][number] & {
  compositeId: string;
  orderId: string;
  orderExternalNumber: string;
  separatedQuantityValue: string;
  isSkipped?: boolean;
  isCancelled?: boolean;
};

type MobileWavePickingPanelProps = {
  orders: ShippingPickingOrder[];
  waveId: string;
  waveCode: string;
  currentUserId: string;
};

function flattenWaveItems(orders: ShippingPickingOrder[]): WaveItemState[] {
  return orders.flatMap((order) =>
    order.items.map((item) => ({
      ...item,
      compositeId: `${order.id}:${item.id}`,
      orderId: order.id,
      orderExternalNumber: order.externalNumber,
      separatedQuantityValue: String(item.separatedQuantity),
    })),
  );
}

function compareWaveItemsForPicking(a: WaveItemState, b: WaveItemState) {
  const routeA = a.routeLines[0];
  const routeB = b.routeLines[0];
  if (routeA && routeB) {
    const areaCompare = routeA.area.localeCompare(routeB.area, "pt-BR");
    if (areaCompare !== 0) return areaCompare;
    const labelCompare = routeA.routeLabel.localeCompare(routeB.routeLabel, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
    if (labelCompare !== 0) return labelCompare;
  }
  return a.orderExternalNumber.localeCompare(b.orderExternalNumber, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function MobileWavePickingPanel({ orders, waveCode, currentUserId }: MobileWavePickingPanelProps) {
  const router = useRouter();
  const initialItems = useMemo(() => flattenWaveItems(orders), [orders]);
  const [items, setItems] = useState<WaveItemState[]>(initialItems);
  const prioritizedItems = useMemo(() => [...items].sort(compareWaveItemsForPicking), [items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scanPhase, setScanPhase] = useState<"address" | "product">("address");
  const [scanValue, setScanValue] = useState("");
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelledOrderIds, setCancelledOrderIds] = useState<string[]>([]);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const completionFormRef = useRef<HTMLFormElement | null>(null);
  const autoSubmittedRef = useRef(false);
  const overlayTimerRef = useRef<number | null>(null);

  const totalCount = prioritizedItems.length;
  const doneCount = Math.min(currentIndex, totalCount);
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const currentItem = prioritizedItems[currentIndex];
  const isDone = !currentItem;
  const phaseColor = scanPhase === "address" ? mobileColors.blue : mobileColors.violet;

  useEffect(() => {
    const timer = window.setTimeout(() => scanInputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [currentIndex, scanPhase]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isDone || totalCount === 0 || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    const timer = window.setTimeout(() => {
      setIsSubmitting(true);
      completionFormRef.current?.requestSubmit();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isDone, totalCount]);

  function flash(next: ScanOverlayState) {
    setOverlay(next);
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), 700);

    if (!next || typeof window === "undefined") return;
    const AudioContextRef =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;
    const context = new AudioContextRef();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = next.type === "ok" ? "sine" : "square";
    oscillator.frequency.value = next.type === "ok" ? 880 : 220;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => void context.close();
  }

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function applyScan(rawValue: string) {
    if (!currentItem) return;
    const normalized = normalizeScan(rawValue);
    if (!normalized) {
      flash({ type: "err", title: "Código vazio", code: "—", sub: "Leia ou digite um código." });
      focusScanInput();
      return;
    }

    if (scanPhase === "address") {
      const expected = normalizeScan(currentItem.routeLines[0]?.addressCode ?? "");
      if (!expected || normalized !== expected) {
        flash({ type: "err", title: "Endereço incorreto", code: rawValue, sub: "Bipe o endereço sugerido na tela." });
        setScanValue("");
        focusScanInput();
        return;
      }
      flash({ type: "ok", title: "Endereço OK", code: currentItem.routeLines[0]?.addressCode ?? "", sub: currentItem.name });
      setScanPhase("product");
      setScanValue("");
      focusScanInput();
      return;
    }

    const matches = [currentItem.barcode, currentItem.sku, currentItem.code]
      .filter(Boolean)
      .some((value) => normalizeScan(String(value)) === normalized);

    if (!matches) {
      flash({ type: "err", title: "Código inválido", code: rawValue, sub: "Este item não pertence a esta posição." });
      setScanValue("");
      focusScanInput();
      return;
    }

    const nextSeparated = Math.min(
      normalizeQuantity(currentItem.separatedQuantityValue) + 1,
      currentItem.requestedQuantity,
    );
    setItems((current) =>
      current.map((item) =>
        item.compositeId === currentItem.compositeId
          ? { ...item, separatedQuantityValue: String(nextSeparated) }
          : item,
      ),
    );

    if (nextSeparated >= currentItem.requestedQuantity) {
      flash({ type: "ok", title: "Item bipado", code: currentItem.sku, sub: `${nextSeparated}/${currentItem.requestedQuantity} · avançando` });
      setTimeout(() => {
        setScanPhase("address");
        setCurrentIndex((idx) => Math.min(idx + 1, totalCount));
      }, 300);
    } else {
      flash({ type: "ok", title: "Item bipado", code: currentItem.sku, sub: `${nextSeparated}/${currentItem.requestedQuantity}` });
    }
    setScanValue("");
    focusScanInput();
  }

  function cancelCurrentOrder() {
    if (!currentItem) return;
    const orderId = currentItem.orderId;
    setCancelledOrderIds((current) => (current.includes(orderId) ? current : [...current, orderId]));
    setItems((current) =>
      current.map((item) =>
        item.orderId === orderId
          ? { ...item, isSkipped: true, isCancelled: true, separatedQuantityValue: "0" }
          : item,
      ),
    );
    void cancelPickingOrderAction(orderId).then((result) => {
      if (!result?.ok) {
        flash({ type: "err", title: "Falha ao cancelar", code: "—", sub: "Não foi possível cancelar por falta de estoque." });
      }
    });
    setScanPhase("address");
    const nextIndex = prioritizedItems.findIndex(
      (item, index) => index > currentIndex && item.orderId !== orderId,
    );
    setCurrentIndex(nextIndex >= 0 ? nextIndex : totalCount);
  }

  return (
    <div className="relative flex h-full flex-col">
      <MobileScanOverlay overlay={overlay} />

      <div className="flex shrink-0 items-center gap-3 px-[18px] pb-3 pt-[18px]">
        <MobileBackButton onClick={() => router.push("/m/separacao")} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[16px] font-extrabold" style={headingFont}>
            Separação
          </span>
          <span className="text-[12px]" style={{ color: mobileColors.muted }}>
            Onda {waveCode}
          </span>
        </div>
        <span
          className="rounded-full px-[11px] py-[5px] text-[11.5px] font-extrabold"
          style={{
            background: hexAlpha(isDone ? mobileColors.green : mobileColors.blue, 0.16),
            color: isDone ? mobileColors.green : mobileColors.blueLight,
          }}
        >
          {isDone ? "Concluída" : `${currentIndex + 1}/${totalCount}`}
        </span>
      </div>

      <div className="shrink-0 px-[18px] pb-3">
        <div className="h-[7px] overflow-hidden rounded-full" style={{ background: hexAlpha("#94A3B8", 0.15) }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, background: mobileGradient }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11.5px]" style={{ color: mobileColors.muted }}>
            {isDone ? "Todos os itens separados" : scanPhase === "address" ? "Vá até o endereço" : "Confirme o produto"}
          </span>
          <span className="text-[11.5px] font-bold" style={{ color: mobileColors.violetLight }}>
            {progressPct}%
          </span>
        </div>
      </div>

      <div className="app-scroll flex flex-1 flex-col gap-4 overflow-y-auto px-[18px] pb-[18px]">
        {currentItem ? (
          <>
            {/* Primary instruction card — matches the mockup's Flow "active" card exactly */}
            <div
              className="flex flex-col gap-3.5 rounded-[20px] p-[18px]"
              style={{
                border: `1px solid ${hexAlpha(phaseColor, 0.3)}`,
                background: hexAlpha("#94A3B8", 0.04),
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] text-[13px] font-extrabold"
                  style={{ background: hexAlpha(phaseColor, 0.18), color: phaseColor, ...headingFont }}
                >
                  {scanPhase === "address" ? "1" : "2"}
                </span>
                <span className="text-[13px] font-extrabold uppercase tracking-wide" style={{ color: phaseColor }}>
                  {scanPhase === "address" ? "Bipe o endereço" : "Bipe o produto"}
                </span>
              </div>

              <div className="flex items-center gap-[13px]">
                <div
                  className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                  style={{ background: `linear-gradient(140deg, ${mobileColors.blue} 0%, ${hexAlpha(mobileColors.blue, 0.55)} 100%)`, color: "rgba(255,255,255,0.92)" }}
                >
                  {currentItem.imageUrl ? (
                    <Image src={currentItem.imageUrl} alt={currentItem.name} width={54} height={54} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <MobileIcon name="box" size={24} />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] font-extrabold leading-tight">{currentItem.name}</span>
                  <span className="text-[12.5px]" style={{ color: mobileColors.muted, ...headingFont }}>
                    {currentItem.sku}
                  </span>
                </div>
              </div>

              <div
                className="flex items-center gap-3 rounded-[15px] p-4"
                style={{ background: "rgba(5,7,13,0.5)", border: `1px dashed ${hexAlpha(phaseColor, 0.4)}` }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]"
                  style={{ background: hexAlpha(phaseColor, 0.16), color: phaseColor }}
                >
                  <MobileIcon name={scanPhase === "address" ? "loc" : "code"} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    {scanPhase === "address" ? "Endereço de picking" : "Código de barras"}
                  </span>
                  <span className="truncate text-[24px] font-bold tracking-wide" style={{ color: mobileColors.text, ...headingFont }}>
                    {scanPhase === "address"
                      ? currentItem.routeLines[0]?.addressCode ?? "—"
                      : currentItem.barcode || currentItem.sku}
                  </span>
                </div>
                {scanPhase === "product" ? (
                  <div className="shrink-0 border-l pl-3 text-center" style={{ borderColor: hexAlpha("#94A3B8", 0.16) }}>
                    <div className="text-[26px] font-extrabold" style={headingFont}>
                      {normalizeQuantity(currentItem.separatedQuantityValue)}/{currentItem.requestedQuantity}
                    </div>
                    <div className="text-[10.5px]" style={{ color: mobileColors.muted }}>un</div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Real scanner capture — a physical reader "types" here then sends Enter */}
            <input
              ref={scanInputRef}
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyScan(scanValue);
                }
              }}
              onBlur={() => window.setTimeout(() => scanInputRef.current?.focus(), 40)}
              placeholder={scanPhase === "address" ? "Aguardando bipagem do endereço..." : "Aguardando bipagem do produto..."}
              className="h-11 w-full rounded-2xl px-4 text-sm font-medium outline-none"
              style={{ border: `1px solid ${hexAlpha(phaseColor, 0.25)}`, background: hexAlpha("#94A3B8", 0.05), color: mobileColors.text }}
            />

            <button
              type="button"
              onClick={() => applyScan(scanValue)}
              className="flex h-[62px] items-center justify-center gap-2 rounded-[17px] text-[16.5px] font-extrabold text-white"
              style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
            >
              <MobileIcon name="scan" size={20} strokeWidth={2} />
              {scanPhase === "address" ? "Bipar endereço" : "Bipar produto"}
            </button>

            <button
              type="button"
              onClick={cancelCurrentOrder}
              className="h-12 rounded-xl text-sm font-bold"
              style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.4)}`, color: mobileColors.redLight }}
            >
              Sem estoque, cancelar pedido
            </button>
          </>
        ) : (
          <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${mobileColors.green}`, animation: "mobileRingPulse 1.6s ease-out infinite" }}
              />
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: hexAlpha(mobileColors.green, 0.16), color: mobileColors.green }}
              >
                <MobileIcon name="check" size={40} strokeWidth={2.6} />
              </span>
            </div>
            <span className="text-[21px] font-bold" style={headingFont}>Onda separada!</span>
            <span className="max-w-[260px] text-[13.5px] leading-relaxed" style={{ color: mobileColors.muted }}>
              {totalCount} itens processados. Direcione o carrinho para a conferência.
              {items.some((i) => i.isSkipped) ? (
                <span className="mt-2 block" style={{ color: mobileColors.amber }}>
                  Há itens pulados por divergência ou ruptura.
                </span>
              ) : null}
            </span>
          </div>
        )}
      </div>

      <form
        ref={completionFormRef}
        action={savePickingWaveProgressAction}
        onSubmit={() => setIsSubmitting(true)}
        className="hidden"
      >
        {orders.map((order) => (
          <input key={order.id} type="hidden" name="waveOrderId" value={order.id} />
        ))}
        <input type="hidden" name="currentUserId" value={currentUserId} />
        <input type="hidden" name="returnTo" value="/m/separacao" />
        <input type="hidden" name="completeRedirectTo" value="/m/conferencia" />
        {cancelledOrderIds.map((orderId) => (
          <input key={orderId} type="hidden" name="cancelledOrderId" value={orderId} />
        ))}
        {items.map((item) => (
          <span key={item.compositeId}>
            <input type="hidden" name="itemOrderId" value={item.orderId} />
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="itemKitProgress" value="" />
            <input
              type="hidden"
              name="separatedQuantity"
              value={item.isSkipped ? "0" : item.separatedQuantityValue}
            />
          </span>
        ))}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Finalizando..." : "Concluir"}
        </button>
      </form>
    </div>
  );
}
