"use client";

import { useEffect, Suspense } from "react";
import { toast } from "sonner";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function FeedbackToastInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const feedback = searchParams.get("feedback");
    if (feedback) {
      if (feedback === "criado") toast.success("Criado com sucesso!");
      else if (feedback === "salvo") toast.success("Atualizado com sucesso!");
      else if (feedback === "excluido") toast.success("Excluído com sucesso!");
      else if (feedback === "concluido") toast.success("Operação concluída com sucesso!");
      else if (feedback === "incompleto") toast.warning("Operação concluída parcialmente. Faltam itens.");
      else if (feedback === "vinculos") toast.error("Não foi possível excluir. O item já possui vínculos.");
      else toast.error("Não foi possível concluir a operação solicitada.");

      // Clean up the URL by removing the feedback param
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("feedback");
      router.replace(`${pathname}?${newParams.toString()}`);
    }
  }, [pathname, router, searchParams]);

  return null;
}

export function FeedbackToast() {
  return (
    <Suspense fallback={null}>
      <FeedbackToastInner />
    </Suspense>
  );
}
