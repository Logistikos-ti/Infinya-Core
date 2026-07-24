import { requireUserContext } from "@/lib/auth";
import { getMobileOperationsSnapshot } from "@/lib/mobile-home";
import { InicioClient } from "./inicio-client";

export default async function MobileHomePage() {
  const user = await requireUserContext();

  const snapshot = await getMobileOperationsSnapshot(user, {
    includeReceiving: true,
    includeShipping: true,
    includeRomaneio: false,
  });

  const totalPendencias =
    snapshot.receiving.count +
    snapshot.picking.count +
    snapshot.conference.count;

  return (
    <InicioClient 
      user={user} 
      snapshot={snapshot} 
      totalPendencias={totalPendencias} 
    />
  );
}
