"use client";

import { useFormStatus } from "react-dom";
import { MobilePrimaryButton, MobileIcon } from "@/components/mobile/mobile-kit";
import { createRomaneioRecordAction } from "@/app/(dashboard)/romaneio/actions";
import type { RomaneioSuggestionDetail } from "@/lib/romaneio-records";

export function GerarRomaneioForm({ suggestion }: { suggestion: RomaneioSuggestionDetail }) {
  return (
    <form action={createRomaneioRecordAction} className="mt-4">
      {suggestion.orders.map((order) => (
        <input key={order.id} type="hidden" name="pedidoIds" value={order.id} />
      ))}
      <input type="hidden" name="transportadoraId" value={suggestion.transportadoraId || ""} />
      <input type="hidden" name="transportadoraNome" value={suggestion.carrierName || ""} />
      <input type="hidden" name="isMobile" value="true" />
      
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <MobilePrimaryButton type="submit" disabled={pending} style={{ height: 48, borderRadius: 14 }}>
      {pending ? (
        <span>Gerando...</span>
      ) : (
        <>
          <span>Gerar Romaneio</span>
          <MobileIcon name="scan" size={18} />
        </>
      )}
    </MobilePrimaryButton>
  );
}
