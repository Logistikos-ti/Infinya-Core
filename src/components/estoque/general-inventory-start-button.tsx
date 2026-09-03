"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

type GeneralInventoryStartButtonProps = {
  inventoryId: string;
  depositanteId: string;
};

export function GeneralInventoryStartButton({ inventoryId, depositanteId }: GeneralInventoryStartButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/estoque/inventarios/${inventoryId}/iniciar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: "GERAL" }),
          });
          if (response.ok) {
            router.push(`/estoque/inventarios/geral/${depositanteId}`);
            return;
          }
          router.refresh();
        });
      }}
    >
      {isPending ? <MobileButtonSpinner /> : "Iniciar contagem"}
    </Button>
  );
}
