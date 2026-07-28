import type { CSSProperties, ReactNode } from "react";

/**
 * Pure design tokens + presentational icon set for the mobile "coletor"
 * design system. Deliberately has NO "use client" directive so Server
 * Components can call hexAlpha()/read mobileColors directly when
 * computing inline styles, instead of only being able to render them.
 * Interactive pieces (cards with onClick, buttons, overlays, shells)
 * live in mobile-kit.tsx, which re-exports everything from here.
 */

export const mobileColors = {
  bg: "#0A1120",
  bgAlt: "#0B1424",
  pageBg: "radial-gradient(1200px 700px at 50% -5%, #10162A 0%, #05070D 60%)",
  text: "#F1F5F9",
  muted: "#8695AD",
  dim: "#56617A",
  blue: "#3B82F6",
  blueLight: "#60A5FA",
  violet: "#8B5CF6",
  violetLight: "#A78BFA",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  redLight: "#F87171",
} as const;

export const mobileGradient = "linear-gradient(92deg,#3B82F6,#8B5CF6)";

export const headingFont: CSSProperties = { fontFamily: "var(--font-space-grotesk), sans-serif" };
export const bodyFont: CSSProperties = { fontFamily: "var(--font-manrope), sans-serif" };

export function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function svg(children: ReactNode, size = 22, strokeWidth = 1.9) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export type MobileIconName =
  | "scan"
  | "box"
  | "pin"
  | "pick"
  | "inbound"
  | "loc"
  | "clip"
  | "user"
  | "logout"
  | "check"
  | "x"
  | "vibrate"
  | "code";

export function MobileIcon({
  name,
  size = 22,
  strokeWidth = 1.9,
}: {
  name: MobileIconName;
  size?: number;
  strokeWidth?: number;
}) {
  switch (name) {
    case "scan":
      return svg(
        <>
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <path d="M3 12h18" />
        </>,
        size,
        strokeWidth,
      );
    case "box":
      return svg(
        <>
          <path d="M12 2 3 7v10l9 5 9-5V7z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 12v10" />
        </>,
        size,
        strokeWidth,
      );
    case "pin":
      return svg(
        <>
          <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </>,
        size,
        strokeWidth,
      );
    case "pick":
      return svg(
        <>
          <path d="M9 4h6l1 4H8z" />
          <path d="M6 8h12l-1.2 12H7.2z" />
          <path d="M9.5 12v4M14.5 12v4" />
        </>,
        size,
        strokeWidth,
      );
    case "inbound":
      return svg(
        <>
          <path d="M3 9h11v9H3z" />
          <path d="M14 12h4l3 3v3h-7z" />
          <circle cx="7" cy="20.5" r="1.4" />
          <circle cx="17.5" cy="20.5" r="1.4" />
          <path d="M8.5 2v5M6 4.5 8.5 7 11 4.5" />
        </>,
        size,
        strokeWidth,
      );
    case "loc":
      return svg(
        <>
          <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.4" />
          <path d="M9 10.5 11 12.5 15 8.5" />
        </>,
        size,
        strokeWidth,
      );
    case "clip":
      return svg(
        <>
          <path d="M9 4h6v3H9z" />
          <path d="M9 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-3" />
          <path d="M8.5 12h7M8.5 16h5" />
        </>,
        size,
        strokeWidth,
      );
    case "user":
      return svg(
        <>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </>,
        size,
        strokeWidth,
      );
    case "logout":
      return svg(
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </>,
        size,
        strokeWidth,
      );
    case "check":
      return svg(<path d="M20 6 9 17l-5-5" />, size, strokeWidth);
    case "x":
      return svg(<path d="M6 6l12 12M18 6 6 18" />, size, strokeWidth);
    case "vibrate":
      return svg(<path d="M2 9v6M22 9v6M6 6h12v12H6z" />, size, strokeWidth);
    case "code":
      return svg(<path d="M4 5v14M8 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />, size, strokeWidth);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Infinity loader — a lemniscate (figure-8) traced by a comet in the
// brand gradient, used as the shared between-pages loading state.
// Points are computed once at module load (pure math, no DOM
// measurement needed) so this renders identically on server and
// client with no hydration flash. No "use client" needed: the only
// animation is a CSS keyframe on stroke-dashoffset.
// ─────────────────────────────────────────────────────────────
const INFINITY_LOOP_POINTS = (() => {
  const steps = 120;
  const cx = 50;
  const cy = 25;
  const scaleX = 45;
  const scaleY = 22;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = cx + scaleX * Math.cos(t);
    const y = cy + scaleY * Math.sin(t) * Math.cos(t);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
})();

export function MobileInfinityLoader({
  size = 132,
  label = "Carregando",
}: {
  size?: number;
  label?: string | null;
}) {
  const gradientId = "mobileInfinityLoaderGradient";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <svg width={size} height={size / 2} viewBox="0 0 100 50" role="img" aria-label="Carregando">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="55%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
        </defs>
        <polyline
          points={INFINITY_LOOP_POINTS}
          fill="none"
          stroke="rgba(148,163,184,0.16)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <polyline
          points={INFINITY_LOOP_POINTS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="20 80"
          style={{ animation: "mobileInfinityTrace 1.5s linear infinite" }}
        />
      </svg>
      {label ? (
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.02em", color: mobileColors.muted, ...bodyFont }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function MobileFullScreenLoader({ label }: { label?: string | null }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: "60dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MobileInfinityLoader label={label} />
    </div>
  );
}
