"use client";

import { useFormStatus } from "react-dom";
import { MobilePrimaryButton, MobileIcon } from "@/components/mobile/mobile-kit";
import { createRomaneioRecordAction } from "@/app/(dashboard)/romaneio/actions";

type GerarRomaneioFormProps = {
  orderIds: string[];
  transportadoraId?: string | null;
  carrierName?: string | null;
};

export function GerarRomaneioForm({ orderIds, transportadoraId, carrierName }: GerarRomaneioFormProps) {
  return (
    <form action={createRomaneioRecordAction} className="mt-4">
      {orderIds.map((id) => (
        <input key={id} type="hidden" name="pedidoIds" value={id} />
      ))}
      <input type="hidden" name="transportadoraId" value={transportadoraId || ""} />
      <input type="hidden" name="transportadoraNome" value={carrierName || ""} />
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
          <MobileIcon name="truck" size={18} />
        </>
      )}
    </MobilePrimaryButton>
  );
}
