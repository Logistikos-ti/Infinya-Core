import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createManualStockExit, uploadManualExitPhoto } from "@/lib/stock-manual-exit";
import { allowedSaidaManualFotoMimeTypes, maxSaidaManualFotoFileSizeBytes } from "@/lib/storage";

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const contentType = request.headers.get("content-type") ?? "";
  let stockId = "";
  let quantity = 0;
  let reason = "";
  let depositanteId = "";
  let photoFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    stockId = String(formData.get("stockId") ?? "").trim();
    quantity = Number(formData.get("quantity") ?? 0);
    reason = String(formData.get("reason") ?? "").trim();
    depositanteId = auth.user.depositanteId ?? String(formData.get("depositanteId") ?? "").trim();
    const rawPhoto = formData.get("photo");
    photoFile = rawPhoto instanceof File && rawPhoto.size > 0 ? rawPhoto : null;
  } else {
    const payload = (await request.json().catch(() => null)) as {
      stockId?: string;
      quantity?: string | number;
      reason?: string;
      depositanteId?: string;
    } | null;

    stockId = String(payload?.stockId ?? "").trim();
    quantity = Number(payload?.quantity ?? 0);
    reason = String(payload?.reason ?? "").trim();
    depositanteId = auth.user.depositanteId ?? String(payload?.depositanteId ?? "").trim();
  }

  if (!stockId || !depositanteId || !reason || !Number.isFinite(quantity) || quantity <= 0) {
    return Response.json({ error: "Informe saldo, quantidade e motivo para registrar a saída manual." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  if (photoFile) {
    if (!allowedSaidaManualFotoMimeTypes.includes(photoFile.type as (typeof allowedSaidaManualFotoMimeTypes)[number])) {
      return Response.json({ error: "Formato de foto não suportado." }, { status: 400 });
    }
    if (photoFile.size > maxSaidaManualFotoFileSizeBytes) {
      return Response.json({ error: "A foto excede o tamanho máximo permitido (6 MB)." }, { status: 400 });
    }
  }

  try {
    const fotoUrl = photoFile
      ? await uploadManualExitPhoto({
          depositanteId,
          fileName: photoFile.name,
          mimeType: photoFile.type,
          bytes: Buffer.from(await photoFile.arrayBuffer()),
        })
      : null;

    const result = await createManualStockExit({
      userId: auth.user.id,
      depositanteId,
      stockId,
      quantity,
      reason,
      fotoUrl,
    });

    return Response.json({ message: "Saída manual registrada com sucesso.", result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível registrar a saída manual." },
      { status: 400 },
    );
  }
}
