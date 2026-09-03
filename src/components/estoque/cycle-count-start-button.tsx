"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

type CycleCountStartButtonProps = {
  cycleCountId: string;
};

export function CycleCountStartButton({ cycleCountId }: CycleCountStartButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await fetch(`/api/estoque/inventarios/${cycleCountId}/iniciar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: "CICLICO" }),
          });
          router.refresh();
        });
      }}
    >
      {isPending ? <MobileButtonSpinner /> : "Iniciar contagem"}
    </Button>
  );
}
