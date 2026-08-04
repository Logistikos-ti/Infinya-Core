"use client";

import { useRouter } from "next/navigation";
import { MobileListShell, mobileColors } from "@/components/mobile/mobile-kit";

export function EstoqueListClient() {
  const router = useRouter();

  return (
    <MobileListShell
      title="Fluxos do Estoque"
      subtitle="Auditoria e controle"
      count="4"
      onBack={() => router.push("/m/inicio")}
      items={[
        {
          icon: "box",
          iconColor: mobileColors.blue,
          title: "Lançar estoque",
          tag: "Entrada",
          tagColor: mobileColors.blue,
          sub: "Registrar a primeira carga",
          onClick: () => router.push("/m/estoque/saldo-inicial"),
        },
        {
          icon: "inbound",
          iconColor: mobileColors.violet,
          title: "Movimentação",
          tag: "Interno",
          tagColor: mobileColors.violet,
          sub: "Transfira saldo entre endereços",
          onClick: () => router.push("/m/estoque/movimentacao-interna"),
        },
        {
          icon: "clip",
          iconColor: mobileColors.amber,
          title: "Inventário cíclico",
          tag: "Auditoria",
          tagColor: mobileColors.amber,
          sub: "Abra contagens cegas",
          onClick: () => router.push("/m/estoque/inventarios"),
        },
        {
          icon: "logout",
          iconColor: mobileColors.red,
          title: "Saída manual",
          tag: "Baixa",
          tagColor: mobileColors.red,
          sub: "Registre perdas, avarias e descartes",
          onClick: () => router.push("/m/estoque/saida-manual"),
        },
      ]}
    />
  );
}
