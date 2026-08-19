import assert from "node:assert/strict";
import { test } from "node:test";
import type { ParsedNfe } from "../../src/lib/nfe-import.ts";
import {
  normalizeProductCode,
  validateReturnInvoiceAgainstOrder,
  type ReturnInvoiceOrderItem,
} from "../../src/lib/return-invoice-validation.ts";

function nfe(items: Array<{ codigo?: string | null; ean?: string | null; descricao?: string; quantidade: number }>): ParsedNfe {
  return {
    accessKey: "35260800000000000000550010000000011000000010",
    noteNumber: "1",
    direction: "SAIDA",
    supplierName: "Armazem",
    supplierDocument: null,
    recipientName: "Depositante",
    recipientDocument: null,
    recipientAddress: null,
    issuedAt: null,
    volumeCount: 1,
    carrierName: null,
    grossWeight: null,
    additionalInfo: null,
    totalValue: 0,
    protocolNumber: null,
    protocolStatusCode: "100",
    protocolStatusLabel: null,
    items: items.map((item) => ({
      codigo: item.codigo ?? null,
      ean: item.ean ?? null,
      descricao: item.descricao ?? "Produto",
      quantidade: item.quantidade,
      lote: null,
      validadeEm: null,
      lotes: [],
      ncm: null,
      cfop: null,
      cstCsosn: null,
      icmsValue: 0,
      ipiValue: 0,
      pisValue: 0,
      cofinsValue: 0,
    })),
  };
}

function orderItem(partial: Partial<ReturnInvoiceOrderItem> & { quantidade: number }): ReturnInvoiceOrderItem {
  return {
    produtoId: null,
    codigoProduto: partial.codigoProduto ?? null,
    sku: partial.sku ?? null,
    nome: partial.nome ?? "Produto",
    quantidade: partial.quantidade,
  };
}

test("aceita a NF quando codigo e quantidade total batem", () => {
  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: "ABC-1", quantidade: 10 })],
    nfe([{ codigo: "ABC-1", quantidade: 10 }]),
  );

  assert.equal(result.ok, true);
  assert.equal(result.divergences.length, 0);
});

test("aceita quando a NF quebra o mesmo produto em varias linhas somando o total", () => {
  // Emissores costumam separar o mesmo SKU por lote; o acordo é comparar o total.
  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: "ABC-1", quantidade: 10 })],
    nfe([
      { codigo: "ABC-1", quantidade: 4 },
      { codigo: "ABC-1", quantidade: 6 },
    ]),
  );

  assert.equal(result.ok, true);
});

test("recusa quando a quantidade diverge", () => {
  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: "ABC-1", nome: "Shampoo", quantidade: 10 })],
    nfe([{ codigo: "ABC-1", quantidade: 8 }]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.divergences.length, 1);
  assert.equal(result.divergences[0].kind, "QUANTIDADE");
  assert.equal(result.divergences[0].expected, 10);
  assert.equal(result.divergences[0].found, 8);
});

test("recusa quando um item do pedido nao esta na NF", () => {
  const result = validateReturnInvoiceAgainstOrder(
    [
      orderItem({ codigoProduto: "ABC-1", quantidade: 5 }),
      orderItem({ codigoProduto: "ABC-2", nome: "Condicionador", quantidade: 3 }),
    ],
    nfe([{ codigo: "ABC-1", quantidade: 5 }]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.divergences.length, 1);
  assert.equal(result.divergences[0].kind, "FALTANDO_NA_NF");
  assert.equal(result.divergences[0].name, "Condicionador");
});

test("recusa quando a NF traz um item que nao foi pedido", () => {
  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: "ABC-1", quantidade: 5 })],
    nfe([
      { codigo: "ABC-1", quantidade: 5 },
      { codigo: "ABC-9", descricao: "Item extra", quantidade: 2 },
    ]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.divergences.length, 1);
  assert.equal(result.divergences[0].kind, "SOBRANDO_NA_NF");
});

test("casa o item pelo SKU quando o pedido nao tem codigo_produto", () => {
  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: null, sku: "SKU-7", quantidade: 2 })],
    nfe([{ codigo: "SKU-7", quantidade: 2 }]),
  );

  assert.equal(result.ok, true);
});

test("casa o item pelo EAN da NF quando o codigo interno nao aparece", () => {
  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: "7891234567890", quantidade: 1 })],
    nfe([{ codigo: null, ean: "7891234567890", quantidade: 1 }]),
  );

  assert.equal(result.ok, true);
});

test("normaliza zeros a esquerda, caixa e espacos no codigo", () => {
  assert.equal(normalizeProductCode("007abc"), "7ABC");
  assert.equal(normalizeProductCode(" ab c "), "ABC");
  assert.equal(normalizeProductCode("000"), "0");

  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: "0042", quantidade: 1 })],
    nfe([{ codigo: "42", quantidade: 1 }]),
  );

  assert.equal(result.ok, true);
});

test("tolera ruido de ponto flutuante em quantidades fracionadas", () => {
  const result = validateReturnInvoiceAgainstOrder(
    [orderItem({ codigoProduto: "ABC-1", quantidade: 0.1 + 0.2 })],
    nfe([{ codigo: "ABC-1", quantidade: 0.3 }]),
  );

  assert.equal(result.ok, true);
});
