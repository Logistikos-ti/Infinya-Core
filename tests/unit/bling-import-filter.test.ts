import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateBlingSaleOrderImport } from "../../src/lib/bling-import-filter.ts";
import type { BlingSaleOrderPayload } from "../../src/lib/bling.ts";
import type { DepositanteBlingImportFilter } from "../../src/lib/depositantes.ts";

function order(overrides: Partial<BlingSaleOrderPayload> = {}): BlingSaleOrderPayload {
  return {
    id: "123",
    numero: "23397",
    numeroLoja: null,
    data: null,
    dataSaida: null,
    total: 100,
    situacao: "Atendido",
    situacaoId: "9",
    loja: { id: "700", nome: "TikTok Shop - JS Matriz" },
    unidadeNegocio: { id: "10", nome: "Matriz" },
    observacoes: null,
    contato: { nome: null, documento: null, cidade: null, uf: null },
    itens: [],
    payload: {},
    ...overrides,
  };
}

function filter(overrides: Partial<DepositanteBlingImportFilter> = {}): DepositanteBlingImportFilter {
  return {
    enabled: true,
    warehouseName: "CD SP - Logistikos",
    acceptedSituationIds: [],
    acceptedSituationNames: ["Atendido"],
    allowedStoreIds: [],
    allowedStoreNames: ["TikTok Shop - JS Matriz"],
    allowedBusinessUnitIds: [],
    allowedBusinessUnitNames: [],
    ...overrides,
  };
}

test("accepts a new order when situation and store match", () => {
  assert.equal(evaluateBlingSaleOrderImport(filter(), order()).allowed, true);
});

test("matches names without accents, casing or repeated spaces", () => {
  const result = evaluateBlingSaleOrderImport(
    filter({ allowedStoreNames: ["  tiktok shop - js matriz "] }),
    order({ loja: { id: null, nome: "TikTok  Shop - JS Matriz" } }),
  );

  assert.equal(result.allowed, true);
});

test("accepts by business unit when the store is not authorized", () => {
  const result = evaluateBlingSaleOrderImport(
    filter({ allowedStoreNames: [], allowedBusinessUnitNames: ["Matriz"] }),
    order({ loja: { id: "999", nome: "Outra loja" } }),
  );

  assert.equal(result.allowed, true);
});

test("accepts by identifier when Bling omits origin names", () => {
  const result = evaluateBlingSaleOrderImport(
    filter({ allowedStoreNames: [], allowedStoreIds: ["700"] }),
    order({ loja: { id: "700", nome: null }, unidadeNegocio: null }),
  );

  assert.equal(result.allowed, true);
});

test("rejects an order from a non-authorized origin", () => {
  const result = evaluateBlingSaleOrderImport(
    filter(),
    order({ loja: { id: "999", nome: "Shopee - Cristiano" }, unidadeNegocio: { id: "20", nome: "Cristiano" } }),
  );

  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /não autorizadas/i);
});

test("rejects an order outside the accepted situation", () => {
  const result = evaluateBlingSaleOrderImport(filter(), order({ situacao: "Em aberto", situacaoId: "6" }));
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /situação/i);
});

test("preserves the legacy status policy while the specific filter is disabled", () => {
  assert.equal(evaluateBlingSaleOrderImport(null, order({ situacao: "Em andamento" })).allowed, true);
  assert.equal(evaluateBlingSaleOrderImport(null, order({ situacao: "Atendido" })).allowed, false);
});
