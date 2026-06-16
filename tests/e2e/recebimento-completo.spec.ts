import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

type SeedContext = {
  depositanteId: string;
  productId: string;
  depositanteNome: string;
  productName: string;
  productSku: string;
  internalCode: string;
  supplierName: string;
  noteNumber: string;
  lotCode: string;
  expiryDate: string;
  expectedQuantity: string;
  createdOrderId?: string;
};

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const e2eEmail = requiredEnv("WMS_E2E_EMAIL");
const e2ePassword = requiredEnv("WMS_E2E_PASSWORD");

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

test.describe("Fluxo completo de recebimento", () => {
  test("abre pedido, confere recebimento e lança no estoque", async ({ page }) => {
    const seed = await createSeedData();

    try {
      await login(page);
      await createReceivingOrderViaUi(page, seed);
      await completeReceivingConferenceViaUi(page, seed);
      await assertDatabaseState(seed);
      await assertStockVisibleViaUi(page, seed);
    } finally {
      await cleanupSeedData(seed);
    }
  });
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(e2eEmail);
  await page.locator('input[name="password"]').fill(e2ePassword);
  await page.getByRole("button", { name: /entrar no wms/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createReceivingOrderViaUi(
  page: import("@playwright/test").Page,
  seed: SeedContext,
) {
  await page.goto("/recebimento/novo");

  const orderForm = page.locator("form").filter({
    has: page.getByRole("button", { name: /abrir recebimento/i }),
  });

  await orderForm.locator("select").nth(0).selectOption(seed.depositanteId);
  await orderForm.locator('input[placeholder="Nome do fornecedor"]').fill(seed.supplierName);
  await orderForm
    .locator('input[placeholder="NÃºmero da NF"], input[placeholder="Número da NF"]')
    .fill(seed.noteNumber);
  await orderForm.locator('input[type="datetime-local"]').fill("2026-06-16T09:30");
  await orderForm.locator('input[placeholder="Ex.: 120"]').fill(seed.expectedQuantity);

  const productSelect = orderForm.locator("select").nth(2);
  await expect(productSelect.locator(`option[value="${seed.productId}"]`)).toHaveCount(1);
  await productSelect.selectOption(seed.productId);

  await orderForm.locator('input[placeholder="Ex.: 24"]').fill(seed.expectedQuantity);
  await orderForm
    .locator('textarea[placeholder*="Informa"], textarea[placeholder*="Informa"]')
    .fill("Fluxo E2E automatizado do recebimento completo.");

  await orderForm.getByRole("button", { name: /abrir recebimento/i }).click();
  await expect(page.getByText(/recebimento criado com sucesso/i)).toBeVisible();

  seed.createdOrderId = await waitForOrderId(seed.noteNumber);
  expect(seed.createdOrderId).toBeTruthy();
}

async function completeReceivingConferenceViaUi(
  page: import("@playwright/test").Page,
  seed: SeedContext,
) {
  await page.goto(`/recebimento/${seed.createdOrderId}`);

  await page.getByLabel(/quantidade recebida/i).first().fill(seed.expectedQuantity);
  await page.getByLabel(/^lote/i).first().fill(seed.lotCode);
  await page.getByLabel(/^validade/i).first().fill(seed.expiryDate);
  await page.getByRole("button", { name: /concluir e lan/i }).click();

  await expect(page.getByText(/recebimento conclu/i)).toBeVisible();
  await expect(page.getByText(seed.lotCode)).toBeVisible();
}

async function assertDatabaseState(seed: SeedContext) {
  const { data: order } = await adminSupabase
    .from("pedidos_recebimento")
    .select("id, status")
    .eq("id", seed.createdOrderId!)
    .maybeSingle();

  expect(order?.status).toBe("RECEBIDO");

  const { data: stockRows } = await adminSupabase
    .from("estoque")
    .select("id, quantidade, lote, validade_em")
    .eq("depositante_id", seed.depositanteId)
    .eq("produto_id", seed.productId)
    .eq("lote", seed.lotCode)
    .eq("validade_em", seed.expiryDate);

  expect(stockRows?.length).toBeGreaterThan(0);
  expect(Number(stockRows?.[0]?.quantidade ?? 0)).toBe(Number(seed.expectedQuantity));

  const { data: movements } = await adminSupabase
    .from("movimentacoes_estoque")
    .select("id, tipo, referencia_tipo, referencia_id")
    .eq("referencia_id", seed.createdOrderId!)
    .eq("tipo", "ENTRADA");

  expect(movements?.length).toBeGreaterThan(0);
  expect(movements?.[0]?.referencia_tipo).toBe("PEDIDO_RECEBIMENTO");
}

async function assertStockVisibleViaUi(
  page: import("@playwright/test").Page,
  seed: SeedContext,
) {
  await page.goto(
    `/estoque?depositante=${seed.depositanteId}&produto=${encodeURIComponent(
      seed.productSku,
    )}&lote=${encodeURIComponent(seed.lotCode)}`,
  );

  const balancesTable = page.locator("table").first();
  await expect(balancesTable.getByRole("cell", { name: seed.productSku, exact: true })).toBeVisible();
  await expect(balancesTable.getByRole("cell", { name: seed.productName, exact: true })).toBeVisible();
  await expect(balancesTable.getByRole("cell", { name: seed.lotCode, exact: true })).toBeVisible();
}

async function createSeedData(): Promise<SeedContext> {
  const uniqueSuffix = `${Date.now()}`;
  const depositanteNome = `E2E Recebimento ${uniqueSuffix}`;
  const internalCode = `E2E-${uniqueSuffix}`;
  const productSku = `SKU-E2E-${uniqueSuffix}`;
  const productName = `Produto E2E ${uniqueSuffix}`;
  const supplierName = `Fornecedor E2E ${uniqueSuffix}`;
  const noteNumber = `NF-E2E-${uniqueSuffix}`;
  const lotCode = `LOT-E2E-${uniqueSuffix}`;
  const expiryDate = "2030-12-31";
  const expectedQuantity = "12";

  const { data: depositante, error: depositanteError } = await adminSupabase
    .from("depositantes")
    .insert({
      codigo: `E2E${uniqueSuffix.slice(-6)}`,
      nome: depositanteNome,
      cnpj: buildUniqueCnpj(uniqueSuffix),
      ativo: true,
      observacoes: "Massa temporária para Playwright E2E.",
    })
    .select("id")
    .single();

  if (depositanteError || !depositante) {
    throw new Error(`Falha ao criar depositante de teste: ${depositanteError?.message}`);
  }

  const { data: product, error: productError } = await adminSupabase
    .from("produtos")
    .insert({
      depositante_id: depositante.id,
      codigo_interno: internalCode,
      codigo_externo: `${uniqueSuffix.slice(-13)}`,
      sku: productSku,
      nome: productName,
      categoria: "E2E",
      metodo_retirada: "FEFO",
      unidade_estocagem: "UNIDADE",
      exige_lote: true,
      exige_validade: true,
      ativo: true,
    })
    .select("id")
    .single();

  if (productError || !product) {
    await adminSupabase.from("depositantes").delete().eq("id", depositante.id);
    throw new Error(`Falha ao criar produto de teste: ${productError?.message}`);
  }

  return {
    depositanteId: depositante.id,
    productId: product.id,
    depositanteNome,
    productName,
    productSku,
    internalCode,
    supplierName,
    noteNumber,
    lotCode,
    expiryDate,
    expectedQuantity,
  };
}

async function cleanupSeedData(seed: SeedContext) {
  if (seed.createdOrderId) {
    await adminSupabase.from("movimentacoes_estoque").delete().eq("referencia_id", seed.createdOrderId);
    await adminSupabase.from("recebimento_tarefas").delete().eq("pedido_recebimento_id", seed.createdOrderId);
    await adminSupabase.from("ocorrencias_operacionais").delete().eq("pedido_recebimento_id", seed.createdOrderId);
    await adminSupabase.from("pedidos_recebimento_itens").delete().eq("pedido_recebimento_id", seed.createdOrderId);
    await adminSupabase.from("pedidos_recebimento").delete().eq("id", seed.createdOrderId);
  }

  await adminSupabase.from("estoque").delete().eq("produto_id", seed.productId);
  await adminSupabase.from("produtos").delete().eq("id", seed.productId);
  await adminSupabase.from("depositantes").delete().eq("id", seed.depositanteId);
}

async function waitForOrderId(noteNumber: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data } = await adminSupabase
      .from("pedidos_recebimento")
      .select("id")
      .eq("nota_fiscal_numero", noteNumber)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Pedido de recebimento não foi localizado após a criação.");
}

function buildUniqueCnpj(seed: string) {
  const digits = seed.replace(/\D/g, "").padStart(14, "0").slice(-14);
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }

  return value;
}
