import { notFound } from "next/navigation";
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

  return (
    <FecharRomaneioClient
      romaneio={romaneio}
      savedDrivers={savedDrivers}
      currentUserName={user.nome || user.email || "Operador"}
    />
  );
}
