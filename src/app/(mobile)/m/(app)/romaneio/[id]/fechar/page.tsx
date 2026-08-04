import { notFound, redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth";
import { getRomaneioRecordDetailFromDb, listSavedDriversFromDb } from "@/lib/romaneio-records";
import { FecharRomaneioClient } from "./fechar-romaneio-client";

type FecharRomaneioPageProps = {
  params: Promise<{ id: string }>;
};

export default async function FecharRomaneioPage({ params }: FecharRomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const { id } = await params;

  const [romaneio, savedDrivers] = await Promise.all([
    getRomaneioRecordDetailFromDb(user, id),
    listSavedDriversFromDb(),
  ]);

  if (!romaneio) {
    notFound();
  }

  // FecharRomaneioClient always mounts on the double-check/scan step and
  // auto-starts the camera -- fine for an ABERTO romaneio, but re-entering
  // this URL for one that's already been finalized (e.g. tapping a stale
  // "Fechar Romaneio" link from a cached list, or navigating back after
  // completing it) dropped the operator straight back into "bipar volumes"
  // as if it needed to be redone. Bounce those back to the list instead.
  if (romaneio.status !== "ABERTO") {
    redirect("/m/romaneio?feedback=ja-finalizado");
  }

  return (
    <FecharRomaneioClient
      romaneio={romaneio}
      savedDrivers={savedDrivers}
      currentUserName={user.nome || user.email || "Operador"}
    />
  );
}
