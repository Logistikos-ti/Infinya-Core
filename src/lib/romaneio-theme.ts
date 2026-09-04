/**
 * Tokens exatos extraídos do mockup "Infinoos WMS — Romaneios" (artifact
 * dc-runtime decodificado). Mesma técnica do nfe-dark-rebrand
 * (nfe-workspace.tsx): CSS custom properties escopadas numa classe,
 * injetadas via <style> DENTRO do componente -- nunca em globals.css, que
 * o dev server (Turbopack) não hot-reloada quando editado.
 *
 * Uso: <style>{ROMANEIO_THEME_CSS}</style> uma vez por subtree (a lista e
 * o drawer compartilham uma árvore; a rota /romaneio/[id] é outra árvore e
 * precisa da sua própria injeção), e um wrapper com className
 * "romaneio-theme" ao redor do conteúdo. Consumir com var(--romaneio-*).
 */
export const ROMANEIO_THEME_CSS = `
.romaneio-theme {
  --romaneio-app-bg: #F5F7FB;
  --romaneio-card-bg: #FFFFFF;
  --romaneio-head-bg: #F8FAFC;
  --romaneio-input-bg: #F8FAFC;
  --romaneio-border: rgba(100,116,139,0.16);
  --romaneio-row-hover: rgba(100,116,139,0.04);
  --romaneio-text: #0F172A;
  --romaneio-text-sub: #64748B;
  --romaneio-drawer-bg: #FFFFFF;
}
.dark .romaneio-theme {
  --romaneio-app-bg: #0A1120;
  --romaneio-card-bg: #101B30;
  --romaneio-head-bg: #0E1728;
  --romaneio-input-bg: #101B30;
  --romaneio-border: rgba(148,163,184,0.14);
  --romaneio-row-hover: rgba(148,163,184,0.05);
  --romaneio-text: #F1F5F9;
  --romaneio-text-sub: #8695AD;
  --romaneio-drawer-bg: #0C1526;
}
`;

export const ROMANEIO_GRADIENT = "linear-gradient(92deg,#3B82F6,#8B5CF6)";
export const ROMANEIO_MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
