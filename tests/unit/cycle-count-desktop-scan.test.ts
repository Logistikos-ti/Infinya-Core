import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveCycleCountDesktopScan,
  type CycleCountDesktopScanItem,
} from "../../src/lib/cycle-count-desktop-scan.ts";

function item(overrides: Partial<CycleCountDesktopScanItem> = {}): CycleCountDesktopScanItem {
  return {
    id: "item-1",
    sku: "SKU-1",
    codigoExterno: "7891234567890",
    codigoInterno: "INT-1",
    codigoExternoPack: null,
    quantidadePorEmbalagem: null,
    enderecoCodigo: "RUA-01-A-1",
    quantidadeSistema: 5,
    quantidadeContada: null,
    status: "PENDENTE",
    ...overrides,
  };
}

function baseState(items: CycleCountDesktopScanItem[], overrides: Partial<{
  activeItemId: string | null;
  activeCount: number;
  pendingDisambiguation: CycleCountDesktopScanItem[] | null;
}> = {}) {
  return {
    items,
    activeItemId: null,
    activeCount: 0,
    pendingDisambiguation: null,
    ...overrides,
  };
}

test("código sem match -> not-found", () => {
  const decision = resolveCycleCountDesktopScan("codigo-desconhecido", baseState([item()]));
  assert.deepEqual(decision, { kind: "not-found" });
});

test("item já CONTADO não é candidato (não é mais contável)", () => {
  const done = item({ status: "CONTADO" });
  const decision = resolveCycleCountDesktopScan("SKU-1", baseState([done]));
  assert.deepEqual(decision, { kind: "not-found" });
});

test("1 candidato pendente -> resolve direto, conta como unidade 1", () => {
  const target = item({ id: "a", quantidadeSistema: 5, quantidadeContada: null });
  const decision = resolveCycleCountDesktopScan("SKU-1", baseState([target]));
  assert.deepEqual(decision, { kind: "switch-item", item: target, nextCount: 1, complete: false });
});

test("2+ candidatos com o mesmo SKU em posições diferentes -> disambiguate", () => {
  const a = item({ id: "a", enderecoCodigo: "RUA-01-A-1", quantidadeSistema: 5 });
  const b = item({ id: "b", enderecoCodigo: "RUA-02-B-3", quantidadeSistema: 3 });
  const decision = resolveCycleCountDesktopScan("SKU-1", baseState([a, b]));
  assert.deepEqual(decision, { kind: "disambiguate", candidates: [a, b] });
});

test("desambiguação: bipe do endereço resolve para o candidato certo", () => {
  const a = item({ id: "a", enderecoCodigo: "RUA-01-A-1", quantidadeSistema: 5 });
  const b = item({ id: "b", enderecoCodigo: "RUA-02-B-3", quantidadeSistema: 3 });
  const state = baseState([a, b], { pendingDisambiguation: [a, b] });
  const decision = resolveCycleCountDesktopScan("RUA-02-B-3", state);
  assert.deepEqual(decision, { kind: "switch-item", item: b, nextCount: 1, complete: false });
});

test("desambiguação: bipe do endereço que não bate com nenhum candidato -> disambiguation-no-match", () => {
  const a = item({ id: "a", enderecoCodigo: "RUA-01-A-1" });
  const b = item({ id: "b", enderecoCodigo: "RUA-02-B-3" });
  const state = baseState([a, b], { pendingDisambiguation: [a, b] });
  const decision = resolveCycleCountDesktopScan("RUA-99-Z-9", state);
  assert.deepEqual(decision, { kind: "disambiguation-no-match" });
});

test("item ativo entre os candidatos ambíguos: continua contando ELE, sem repetir a desambiguação", () => {
  const a = item({ id: "a", enderecoCodigo: "RUA-01-A-1", quantidadeSistema: 5 });
  const b = item({ id: "b", enderecoCodigo: "RUA-02-B-3", quantidadeSistema: 3 });
  // "a" já foi escolhido e está em contagem (activeItemId="a", 2 unidades já bipadas).
  const state = baseState([a, b], { activeItemId: "a", activeCount: 2 });
  const decision = resolveCycleCountDesktopScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "increment", item: a, nextCount: 3, complete: false });
});

test("bipe que fecha exatamente no limite -> complete=true", () => {
  const target = item({ id: "a", quantidadeSistema: 5 });
  const state = baseState([target], { activeItemId: "a", activeCount: 4 });
  const decision = resolveCycleCountDesktopScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "increment", item: target, nextCount: 5, complete: true });
});

test("bipe além do limite -> surplus-prompt, sem incrementar", () => {
  const target = item({ id: "a", quantidadeSistema: 5 });
  const state = baseState([target], { activeItemId: "a", activeCount: 5 });
  const decision = resolveCycleCountDesktopScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "surplus-prompt", item: target, switchingItem: false, seededCount: 5 });
});

test("modo cego (quantidadeSistema null): nunca gera surplus-prompt nem complete=true, mesmo após muitos bipes", () => {
  const blind = item({ id: "a", quantidadeSistema: null });
  let state = baseState([blind], { activeItemId: "a", activeCount: 0 });

  for (let i = 1; i <= 20; i++) {
    const decision = resolveCycleCountDesktopScan("SKU-1", state);
    // activeItemId já é "a" desde antes do loop, então mesmo o primeiro
    // bipe é "increment" (não há troca de item a fazer).
    assert.equal(decision.kind, "increment");
    assert.equal((decision as { complete: boolean }).complete, false);
    const nextCount = (decision as { nextCount: number }).nextCount;
    assert.equal(nextCount, i);
    state = baseState([blind], { activeItemId: "a", activeCount: nextCount });
  }
});

test("bipe do código de pack conta como a quantidade da embalagem, não como 1", () => {
  const target = item({ id: "a", codigoExternoPack: "PACK-12", quantidadePorEmbalagem: 12, quantidadeSistema: 100 });
  const decision = resolveCycleCountDesktopScan("PACK-12", baseState([target]));
  assert.deepEqual(decision, { kind: "switch-item", item: target, nextCount: 12, complete: false });
});

test("bipe do código de pack no item ativo soma a quantidade da embalagem ao total já contado", () => {
  const target = item({ id: "a", codigoExternoPack: "PACK-12", quantidadePorEmbalagem: 12, quantidadeSistema: 100 });
  const state = baseState([target], { activeItemId: "a", activeCount: 24 });
  const decision = resolveCycleCountDesktopScan("PACK-12", state);
  assert.deepEqual(decision, { kind: "increment", item: target, nextCount: 36, complete: false });
});

test("bipe do código regular do mesmo produto continua contando como 1, mesmo com pack cadastrado", () => {
  const target = item({ id: "a", codigoExternoPack: "PACK-12", quantidadePorEmbalagem: 12, quantidadeSistema: 100 });
  const decision = resolveCycleCountDesktopScan("SKU-1", baseState([target]));
  assert.deepEqual(decision, { kind: "switch-item", item: target, nextCount: 1, complete: false });
});

test("bipe do código de pack sem quantidadePorEmbalagem cadastrada conta como 1 (fallback seguro)", () => {
  const target = item({ id: "a", codigoExternoPack: "PACK-12", quantidadePorEmbalagem: null, quantidadeSistema: 100 });
  const decision = resolveCycleCountDesktopScan("PACK-12", baseState([target]));
  assert.deepEqual(decision, { kind: "switch-item", item: target, nextCount: 1, complete: false });
});

test("resolver dois SKUs diferentes sem ambiguidade nenhuma, mesmo com mais de um item na lista", () => {
  const a = item({ id: "a", sku: "SKU-A", codigoExterno: "111", quantidadeSistema: 5 });
  const b = item({ id: "b", sku: "SKU-B", codigoExterno: "222", quantidadeSistema: 3 });
  const decisionA = resolveCycleCountDesktopScan("SKU-A", baseState([a, b]));
  assert.deepEqual(decisionA, { kind: "switch-item", item: a, nextCount: 1, complete: false });
  const decisionB = resolveCycleCountDesktopScan("222", baseState([a, b]));
  assert.deepEqual(decisionB, { kind: "switch-item", item: b, nextCount: 1, complete: false });
});
