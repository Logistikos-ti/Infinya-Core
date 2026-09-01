// Pure status-guard logic for saveShippingConferenceAction in
// src/app/(dashboard)/expedicao/conferencia/actions.ts. Framework-free (no
// "use server", no Supabase, no Next imports) so it can be unit-tested
// directly -- see tests/unit/shipping-conference-status.test.ts.
//
// Background: saveShippingConferenceAction only ever checked
// isOrderLockedForDecision (EM_CANCELAMENTO/EM_DIVERGENCIA) before writing a
// new status/payload_origem -- it never checked whether the order was still
// actually in conference. A duplicate form submission (double-click on
// "concluir conferência", a resubmitted stale request) landing after the
// order had already advanced to CONFERIDO/PRONTO_ROMANEIO/EXPEDIDO would
// silently re-run the whole finalization: re-stamping danfe_conferida_em,
// re-calling garantir_baixa_fisica_pedido, and re-assigning a romaneio. This
// is exactly what happened to WMS-1680 (Volcà/NF3286): danfe_conferida_em
// got written twice, 50s apart, by the same operator, with the order sitting
// at PRONTO_ROMANEIO the whole time. Same bug class already fixed on the
// picking side -- see src/lib/shipping-picking-status.ts.

/** Statuses where a conference save action is allowed to touch order.status/payload_origem. */
export const CONFERENCE_EDITABLE_STATUSES = new Set(["SEPARADO", "EM_CONFERENCIA"]);

export function isConferenceStatusEditable(status: string): boolean {
  return CONFERENCE_EDITABLE_STATUSES.has(status);
}
