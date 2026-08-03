"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  mobileColors,
  mobileGradient,
  headingFont,
  bodyFont,
  hexAlpha,
  MobileIcon,
  MobileInfinityLoader,
  MobileFullScreenLoader,
  type MobileIconName,
} from "@/components/mobile/mobile-kit-tokens";

/**
 * Interactive visual language for the mobile app, ported 1:1 from the
 * "infinoos-wms-coletor-operador" design mockup (cards, buttons, scan
 * overlay, generic list/flow shells). Pure tokens (colors, hexAlpha,
 * fonts, icons) live in mobile-kit-tokens.tsx so Server Components can
 * use them too — this file re-exports them for convenience.
 */
export { mobileColors, mobileGradient, headingFont, bodyFont, hexAlpha, MobileIcon, MobileInfinityLoader, MobileFullScreenLoader };
export type { MobileIconName };

// ─────────────────────────────────────────────────────────────
// Card — flat rgba, no backdrop-blur (cheap to repeat in lists)
// ─────────────────────────────────────────────────────────────
export function MobileCard({
  children,
  as: Tag = "div",
  onClick,
  style,
  className,
}: {
  children: ReactNode;
  as?: "div" | "button";
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const base: CSSProperties = {
    textAlign: "left",
    borderRadius: 16,
    border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`,
    background: hexAlpha("#94A3B8", 0.045),
    ...style,
  };
  if (Tag === "button") {
    return (
      <button type="button" onClick={onClick} style={base} className={className}>
        {children}
      </button>
    );
  }
  return (
    <div style={base} className={className}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Primary button — gradient, used for every main CTA
// ─────────────────────────────────────────────────────────────
export function MobilePrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 62,
        border: "none",
        borderRadius: 17,
        background: disabled ? hexAlpha("#94A3B8", 0.16) : mobileGradient,
        color: disabled ? mobileColors.dim : "#fff",
        fontSize: 16.5,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : "0 10px 26px rgba(99,102,241,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        ...bodyFont,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function MobileBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
        background: hexAlpha("#94A3B8", 0.06),
        color: mobileColors.text,
        cursor: "pointer",
        fontSize: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      &#8249;
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Scan feedback overlay — full-screen flash after every "bip"
// ─────────────────────────────────────────────────────────────
export type ScanOverlayState = {
  type: "ok" | "err" | "warn";
  title: string;
  code: string;
  sub: string;
} | null;

const overlayStyles: Record<"ok" | "err" | "warn", { bg: string; icon: MobileIconName; size: number }> = {
  ok: { bg: "linear-gradient(180deg,#065F46,#047857)", icon: "check", size: 54 },
  err: { bg: "linear-gradient(180deg,#991B1B,#B91C1C)", icon: "x", size: 52 },
  warn: { bg: "linear-gradient(180deg,#92610A,#B45309)", icon: "clip", size: 48 },
};

export function MobileScanOverlay({ overlay }: { overlay: ScanOverlayState }) {
  if (!overlay) return null;
  const style = overlayStyles[overlay.type];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: 40,
        textAlign: "center",
        background: style.bg,
        animation: "mobileScanFlash 0.18s ease",
      }}
    >
      <div style={{ position: "relative", width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.5)",
            animation: "mobileRingPulse 1.1s ease-out infinite",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.5)",
            animation: "mobileRingPulse 1.1s ease-out infinite 0.35s",
          }}
        />
        <span
          style={{
            width: 108,
            height: 108,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            animation: "mobilePopScale 0.3s cubic-bezier(.3,1.4,.5,1)",
          }}
        >
          <MobileIcon name={style.icon} size={style.size} strokeWidth={3} />
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: "#fff", letterSpacing: "0.01em", ...headingFont }}>
          {overlay.title}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.08em", ...headingFont }}>
          {overlay.code}
        </span>
        <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginTop: 2, maxWidth: 260 }}>{overlay.sub}</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.16)",
        }}
      >
        <span style={{ display: "flex", color: "#fff" }}>
          <MobileIcon name="vibrate" size={15} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Bipe + vibração</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ListShell — generic module index (used by picking/receiving/
// inventory/enderecos lists)
// ─────────────────────────────────────────────────────────────
export type MobileListItem = {
  icon: MobileIconName;
  iconColor: string;
  // When set, shows the product photo instead of the icon square; the icon
  // stays as a fallback for items with no photo on file.
  imageUrl?: string | null;
  title: string;
  tag: string;
  tagColor: string;
  sub: string;
  onClick: () => void;
};

export function MobileListShell({
  title,
  subtitle,
  count,
  onBack,
  createLabel,
  onCreate,
  items,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  count: string;
  onBack: () => void;
  createLabel?: string;
  onCreate?: () => void;
  items: MobileListItem[];
  emptyLabel?: string;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: "18px 18px 14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <MobileBackButton onClick={onBack} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>{title}</span>
          <span style={{ fontSize: 12, color: mobileColors.muted }}>{subtitle}</span>
        </div>
        <span
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 800,
            background: hexAlpha("#94A3B8", 0.1),
            color: mobileColors.muted,
            flexShrink: 0,
          }}
        >
          {count}
        </span>
      </div>

      {onCreate && createLabel ? (
        <div style={{ flexShrink: 0, padding: "0 18px 14px 18px" }}>
          <MobilePrimaryButton onClick={onCreate} style={{ height: 52 }}>
            + {createLabel}
          </MobilePrimaryButton>
        </div>
      ) : null}

      <div
        className="app-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px 18px", display: "flex", flexDirection: "column", gap: 11 }}
      >
        {items.length ? (
          items.map((it, i) => (
            <MobileCard
              as="button"
              key={i}
              onClick={it.onClick}
              style={{ padding: 15, display: "flex", alignItems: "center", gap: 13 }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  borderRadius: 12,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: it.imageUrl ? "transparent" : hexAlpha(it.iconColor, 0.16),
                  color: it.iconColor,
                }}
              >
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <MobileIcon name={it.icon} size={22} />
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 800, ...headingFont }}>{it.title}</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      background: hexAlpha(it.tagColor, 0.16),
                      color: it.tagColor,
                    }}
                  >
                    {it.tag}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: mobileColors.muted,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {it.sub}
                </span>
              </div>
              <span style={{ color: mobileColors.dim, fontSize: 19, fontWeight: 700, flexShrink: 0 }}>&#8250;</span>
            </MobileCard>
          ))
        ) : (
          <div
            style={{
              borderRadius: 16,
              border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`,
              padding: "28px 16px",
              textAlign: "center",
              fontSize: 13,
              color: mobileColors.muted,
            }}
          >
            {emptyLabel ?? "Nada por aqui ainda."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FlowShell — generic step-by-step operational flow (picking,
// receiving, putaway/novo-endereco, inventory)
// ─────────────────────────────────────────────────────────────
export type MobileFlowCard = {
  border: string;
  stepNum: string;
  stepColor: string;
  action: string;
  showProduct?: boolean;
  name?: string;
  sku?: string;
  thumbColor?: string;
  targetBorder: string;
  targetIcon: MobileIconName;
  targetIconColor: string;
  targetLabel: string;
  targetValue: string;
  showQty?: boolean;
  qty?: string | number;
};

export type MobileFlowListItem = {
  mark: "check" | "dot" | "none";
  markColor: string;
  name: string;
  nameColor?: string;
  sku: string;
  count: string;
  countColor: string;
};

export function MobileFlowShell({
  title,
  subtitle,
  tag,
  tagColor,
  progressPct,
  progressLabel,
  onBack,
  done,
  doneTitle,
  doneSub,
  onDoneContinue,
  card,
  list,
  inventoryCounter,
  primaryLabel,
  onPrimary,
  onSimulateError,
  overlay,
}: {
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  progressPct: string;
  progressLabel: string;
  onBack: () => void;
  done: boolean;
  doneTitle?: string;
  doneSub?: string;
  onDoneContinue?: () => void;
  card?: MobileFlowCard;
  list?: MobileFlowListItem[];
  inventoryCounter?: { count: number; system: number; onInc: () => void; onDec: () => void };
  primaryLabel?: string;
  onPrimary?: () => void;
  onSimulateError?: () => void;
  overlay?: ScanOverlayState;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
      <div style={{ flexShrink: 0, padding: "18px 18px 12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <MobileBackButton onClick={onBack} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>{title}</span>
          <span style={{ fontSize: 12, color: mobileColors.muted }}>{subtitle}</span>
        </div>
        <span
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 800,
            background: hexAlpha(tagColor, 0.16),
            color: tagColor,
            flexShrink: 0,
          }}
        >
          {tag}
        </span>
      </div>

      <div style={{ flexShrink: 0, padding: "0 18px 14px 18px" }}>
        <div style={{ height: 7, borderRadius: 999, background: hexAlpha("#94A3B8", 0.12), overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: progressPct,
              borderRadius: 999,
              background: mobileGradient,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 11.5, color: mobileColors.muted }}>{progressLabel}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: mobileColors.violetLight }}>{progressPct}</span>
        </div>
      </div>

      <div className="app-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px 18px", display: "flex", flexDirection: "column" }}>
        {done ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: 20 }}>
            <div style={{ position: "relative", width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `2px solid ${mobileColors.green}`,
                  animation: "mobileRingPulse 1.6s ease-out infinite",
                }}
              />
              <span
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: hexAlpha(mobileColors.green, 0.16),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: mobileColors.green,
                }}
              >
                <MobileIcon name="check" size={40} strokeWidth={2.6} />
              </span>
            </div>
            <span style={{ fontSize: 21, fontWeight: 800, ...headingFont }}>{doneTitle}</span>
            <span style={{ fontSize: 13.5, color: mobileColors.muted, lineHeight: 1.5, maxWidth: 260 }}>{doneSub}</span>
            {onDoneContinue ? (
              <MobilePrimaryButton onClick={onDoneContinue} style={{ height: 54, width: "auto", padding: "0 30px", marginTop: 6 }}>
                Concluir tarefa
              </MobilePrimaryButton>
            ) : null}
          </div>
        ) : (
          <>
            {card ? (
              <div
                style={{
                  borderRadius: 20,
                  border: `1px solid ${card.border}`,
                  background: hexAlpha("#94A3B8", 0.04),
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: hexAlpha(card.stepColor, 0.18),
                      color: card.stepColor,
                      fontSize: 13,
                      fontWeight: 800,
                      ...headingFont,
                    }}
                  >
                    {card.stepNum}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: card.stepColor }}>
                    {card.action}
                  </span>
                </div>

                {card.showProduct ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        flexShrink: 0,
                        borderRadius: 14,
                        background: card.thumbColor
                          ? `linear-gradient(140deg,${card.thumbColor} 0%,${hexAlpha(card.thumbColor, 0.55)} 100%)`
                          : hexAlpha("#94A3B8", 0.2),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.92)",
                      }}
                    >
                      <MobileIcon name="box" size={24} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{card.name}</span>
                      <span style={{ fontSize: 12.5, color: mobileColors.muted, ...headingFont }}>{card.sku}</span>
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 16,
                    borderRadius: 15,
                    background: "rgba(5,7,13,0.5)",
                    border: `1px dashed ${card.targetBorder}`,
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: hexAlpha(card.targetIconColor, 0.16),
                      color: card.targetIconColor,
                    }}
                  >
                    <MobileIcon name={card.targetIcon} size={20} />
                  </span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 11, color: mobileColors.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {card.targetLabel}
                    </span>
                    <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.04em", color: mobileColors.text, ...headingFont }}>
                      {card.targetValue}
                    </span>
                  </div>
                  {card.showQty ? (
                    <div style={{ textAlign: "center", paddingLeft: 12, borderLeft: `1px solid ${hexAlpha("#94A3B8", 0.16)}` }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: mobileColors.text, ...headingFont }}>{card.qty}</div>
                      <div style={{ fontSize: 10.5, color: mobileColors.muted }}>un</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {list ? (
              <div
                style={{
                  borderRadius: 18,
                  border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`,
                  background: hexAlpha("#94A3B8", 0.04),
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                {list.map((li, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 15px",
                      borderBottom: i < list.length - 1 ? `1px solid ${hexAlpha("#94A3B8", 0.09)}` : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        flexShrink: 0,
                        borderRadius: 7,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: hexAlpha(li.markColor, 0.18),
                        color: li.markColor,
                        fontSize: 12,
                      }}
                    >
                      {li.mark === "check" ? <MobileIcon name="check" size={13} strokeWidth={2.6} /> : li.mark === "dot" ? "●" : null}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: li.nameColor ?? mobileColors.text,
                        }}
                      >
                        {li.name}
                      </span>
                      <span style={{ fontSize: 11, color: mobileColors.muted, ...headingFont }}>{li.sku}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: li.countColor, ...headingFont }}>{li.count}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {inventoryCounter ? (
              <div
                style={{
                  borderRadius: 18,
                  border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`,
                  background: hexAlpha("#94A3B8", 0.04),
                  padding: 16,
                  marginBottom: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 700, color: mobileColors.muted, textAlign: "center" }}>
                  Quantidade contada
                </span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
                  <button
                    type="button"
                    onClick={inventoryCounter.onDec}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`,
                      background: hexAlpha("#94A3B8", 0.08),
                      color: mobileColors.text,
                      fontSize: 26,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    &minus;
                  </button>
                  <span style={{ fontSize: 46, fontWeight: 700, minWidth: 90, textAlign: "center", color: mobileColors.text, ...headingFont }}>
                    {inventoryCounter.count}
                  </span>
                  <button
                    type="button"
                    onClick={inventoryCounter.onInc}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`,
                      background: hexAlpha("#94A3B8", 0.08),
                      color: mobileColors.text,
                      fontSize: 26,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
                <span style={{ fontSize: 11.5, color: mobileColors.dim, textAlign: "center" }}>
                  Sistema registra {inventoryCounter.system} un neste endereço
                </span>
              </div>
            ) : null}

            <div style={{ flex: 1 }} />

            {primaryLabel && onPrimary ? (
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, paddingBottom: 6 }}>
                <MobilePrimaryButton onClick={onPrimary}>
                  <MobileIcon name="scan" size={20} strokeWidth={2} />
                  {primaryLabel}
                </MobilePrimaryButton>
                {onSimulateError ? (
                  <button
                    type="button"
                    onClick={onSimulateError}
                    style={{
                      height: 44,
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 13,
                      background: "rgba(239,68,68,0.08)",
                      color: mobileColors.redLight,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      ...bodyFont,
                    }}
                  >
                    Simular leitura incorreta
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <MobileScanOverlay overlay={overlay ?? null} />
    </div>
  );
}
