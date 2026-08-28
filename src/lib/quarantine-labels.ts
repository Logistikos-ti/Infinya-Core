// Pure, framework-free label helpers for the stock-quarantine UI, kept in their
// own module (no Supabase/server imports) so both the server lib
// (src/lib/stock-quarantine.ts) and the "use client" quarantine views can
// import them without pulling the admin client into the client bundle.

// For an expired lot, "doar / liberar" (donate) reads wrong -- the depositante's
// real choice is to take it back (retirar) or discard it. Same underlying DOAR
// decision/mechanism, just a label that fits the context.
export function quarantineDonateLabel(tipo: string | null | undefined) {
  return (tipo ?? "").trim().toUpperCase() === "VENCIMENTO" ? "Retirar" : "Doar / liberar";
}

export function quarantineDonatedLabel(tipo: string | null | undefined) {
  return (tipo ?? "").trim().toUpperCase() === "VENCIMENTO" ? "Retirado" : "Doado / liberado";
}
