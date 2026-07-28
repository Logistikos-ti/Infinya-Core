"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors, hexAlpha } from "@/components/mobile/mobile-kit";

type RelationName = { nome?: string } | { nome?: string }[] | null;

type PickingWaveRow = {
  id: string;
  codigo: string;
  status: string;
  criado_em: string;
  atualizado_em: string | null;
  iniciado_em: string | null;
  operador: RelationName;
  pedidos: Array<{ pedido_expedicao_id: string }> | null;
};

type SeparacaoListClientProps = {
  waves: PickingWaveRow[];
  feedback: string;
};

function extractOperatorName(value: RelationName) {
  if (Array.isArray(value)) {
    return value[0]?.nome ?? null;
  }
  return value?.nome ?? null;
}

function statusMeta(status: string) {
  if (status === "EM_SEPARACAO") {
    return { label: "Em separação", color: mobileColors.blue };
  }
  return { label: "Aguardando", color: mobileColors.amber };
}

export function SeparacaoListClient({ waves, feedback }: SeparacaoListClientProps) {
  const router = useRouter();

  return (
    <div className="relative flex h-full flex-col">
      {feedback ? (
        <div className="shrink-0 px-[18px] pt-[18px] pb-0">
          <div
            className="rounded-[15px] px-4 py-3 text-sm font-semibold"
            style={{
              background: hexAlpha(feedback === "concluido" ? mobileColors.green : mobileColors.amber, 0.1),
              border: `1px solid ${hexAlpha(feedback === "concluido" ? mobileColors.green : mobileColors.amber, 0.2)}`,
              color: feedback === "concluido" ? mobileColors.green : mobileColors.amber,
            }}
          >
            {feedback === "inatividade" && "Onda devolvida por inatividade."}
            {feedback === "incompleto" && "Ainda há itens pendentes nesta onda."}
            {feedback === "concluido" && "Separação concluída com sucesso."}
            {feedback === "erro" && "Não foi possível concluir a operação solicitada."}
          </div>
        </div>
      ) : null}

      <MobileListShell
        title="Separação"
        subtitle="Ondas de separação"
        count={`${waves.length} onda${waves.length === 1 ? "" : "s"}`}
        onBack={() => router.push("/m/inicio")}
        createLabel="Criar onda"
        onCreate={() => router.push("/m/separacao/nova")}
        emptyLabel="Nenhuma onda em execução no momento."
        items={waves.map((wave) => {
          const meta = statusMeta(wave.status);
          const operatorName = extractOperatorName(wave.operador);
          const orderCount = wave.pedidos?.length ?? 0;

          return {
            icon: "pick",
            iconColor: mobileColors.blue,
            title: wave.codigo,
            tag: meta.label,
            tagColor: meta.color,
            sub: operatorName
              ? `${orderCount} pedido${orderCount === 1 ? "" : "s"} · ${operatorName}`
              : `${orderCount} pedido${orderCount === 1 ? "" : "s"}`,
            onClick: () => router.push(`/m/separacao/${wave.id}`),
          };
        })}
      />
    </div>
  );
}
