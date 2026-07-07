"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type CycleCountCompleteButtonProps = {
  cycleCountId: string;
};

export function CycleCountCompleteButton({ cycleCountId }: CycleCountCompleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("Deseja concluir esta contagem cíclica agora?")) {
          return;
        }

        startTransition(async () => {
          await fetch("/api/estoque/inventarios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "concluir",
              cycleCountId,
            }),
          });
          router.refresh();
        });
      }}
    >
      {isPending ? "Concluindo..." : "Concluir contagem"}
    </Button>
  );
}
