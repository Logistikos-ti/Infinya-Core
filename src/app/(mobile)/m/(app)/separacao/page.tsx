import { requireModuleAccess } from "@/lib/auth";
import { listActivePickingWavesAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { SeparacaoListClient } from "./separacao-list-client";

type MobilePickingQueuePageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function MobilePickingQueuePage({
  searchParams,
}: MobilePickingQueuePageProps) {
  await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";

  const waves = await listActivePickingWavesAction();

  return <SeparacaoListClient waves={waves} feedback={feedback} />;
}
