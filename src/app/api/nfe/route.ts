import { filterItemsByUserDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { listNfeInbox } from "@/lib/wms-data";

export async function GET() {
  const auth = await requireApiModuleAccess("nfe");

  if (auth.response) {
    return auth.response;
  }

  return Response.json({
    inbox: filterItemsByUserDepositante(auth.user, listNfeInbox(), (item) => {
      if (item.linked === "REC-240610-001") return "Evolveg";
      if (item.linked === "REC-240610-003") return "Sua Aliada";
      return null;
    }),
  });
}
