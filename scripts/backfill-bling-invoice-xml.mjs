import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
const envText = fs.readFileSync(envPath, "utf8");

for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const documentsBucketName = "wms-documentos";

async function main() {
  const depositanteName = process.argv[2] || "Evolveg";
  const depositante = await loadDepositante(depositanteName);
  const accessToken = await ensureValidAccessToken(depositante.configuracoes.bling);
  const orders = await loadCandidateOrders(depositante.id);

  let attached = 0;
  let skippedWithoutInvoice = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const order of orders) {
    const noteId = readString(order.payload_origem?.notaFiscal?.id);

    if (!noteId || noteId === "0") {
      skippedWithoutInvoice += 1;
      continue;
    }

    const existingTypes = await listOrderDocumentTypes(order.id);
    if (existingTypes.has("NF")) {
      skippedExisting += 1;
      continue;
    }

    try {
      const invoice = await fetchJson(
        `https://api.bling.com.br/Api/v3/nfe/${noteId}`,
        accessToken,
        "Falha ao consultar a nota fiscal no Bling.",
      );

      const accessKey = readString(invoice?.data?.chaveAcesso);
      const invoiceNumber = readString(invoice?.data?.numero) || noteId;

      if (!accessKey) {
        console.log(`SKIP ${order.codigo}: nota ${noteId} ainda sem chave de acesso.`);
        continue;
      }

      const documentUrl = new URL(
        `https://api.bling.com.br/Api/v3/nfe/documento/${encodeURIComponent(accessKey)}`,
      );
      documentUrl.searchParams.set("formato", "xml");

      const xmlResponse = await fetch(documentUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/xml,text/xml,application/octet-stream",
        },
      });

      if (!xmlResponse.ok) {
        throw new Error(`Falha ao baixar XML (${xmlResponse.status}).`);
      }

      const xmlPayload = await xmlResponse.json();
      const base64Content = readString(xmlPayload?.data?.[0]?.conteudo);
      const remoteName =
        readString(xmlPayload?.data?.[0]?.nome) ||
        `nf-${order.numero_pedido || order.codigo}-${invoiceNumber}.xml`;

      if (!base64Content) {
        throw new Error("Resposta do XML sem conteúdo.");
      }

      const bytes = Buffer.from(base64Content, "base64");
      await storeDocument({
        depositanteId: depositante.id,
        shippingOrderId: order.id,
        fileName: remoteName,
        bytes,
      });

      attached += 1;
      console.log(`OK ${order.codigo}: XML anexado.`);
    } catch (error) {
      failed += 1;
      console.log(
        `FAIL ${order.codigo}: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }
  }

  console.log("");
  console.log(
    JSON.stringify(
      {
        depositante: depositante.nome,
        totalOrders: orders.length,
        attached,
        skippedWithoutInvoice,
        skippedExisting,
        failed,
      },
      null,
      2,
    ),
  );
}

async function loadDepositante(name) {
  const { data, error } = await supabase
    .from("depositantes")
    .select("id, nome, configuracoes")
    .eq("nome", name)
    .single();

  if (error || !data?.configuracoes?.bling) {
    throw new Error(`Depositante ${name} não encontrado ou sem integração Bling ativa.`);
  }

  return data;
}

async function ensureValidAccessToken(config) {
  const expiresAt = config.expiresAt ? new Date(config.expiresAt).getTime() : Number.NaN;

  if (config.accessToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return config.accessToken;
  }

  const response = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "1.0",
      Authorization: `Basic ${Buffer.from(
        `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Falha ao renovar token do Bling: ${text}`);
  }

  const payload = JSON.parse(text);
  return payload.access_token;
}

async function loadCandidateOrders(depositanteId) {
  const { data, error } = await supabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, payload_origem")
    .eq("depositante_id", depositanteId)
    .eq("origem", "BLING")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listOrderDocumentTypes(shippingOrderId) {
  const { data, error } = await supabase
    .from("documentos_armazenados")
    .select("tipo")
    .eq("pedido_expedicao_id", shippingOrderId);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((item) => item.tipo));
}

async function fetchJson(url, accessToken, fallbackMessage) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || fallbackMessage);
  }

  return JSON.parse(text);
}

async function storeDocument({ depositanteId, shippingOrderId, fileName, bytes }) {
  const safeName = sanitizeFileName(fileName);
  const storagePath = `${depositanteId}/${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;

  const uploadResult = await supabase.storage
    .from(documentsBucketName)
    .upload(storagePath, bytes, {
      contentType: "application/xml",
      upsert: false,
    });

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message);
  }

  const { error } = await supabase.from("documentos_armazenados").insert({
    depositante_id: depositanteId,
    pedido_expedicao_id: shippingOrderId,
    tipo: "NF",
    nome_arquivo: fileName,
    caminho_storage: storagePath,
    mime_type: "application/xml",
    tamanho_bytes: bytes.byteLength,
    enviado_por: null,
  });

  if (error) {
    await supabase.storage.from(documentsBucketName).remove([storagePath]);
    throw new Error(error.message);
  }
}

function readString(value) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function sanitizeFileName(fileName) {
  return String(fileName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

await main();
