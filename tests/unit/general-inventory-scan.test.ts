import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findGeneralInventoryScanItem,
  resolveGeneralInventoryScan,
  type GeneralInventoryScanItem,
} from "../../src/lib/general-inventory-scan.ts";

function item(overrides: Partial<GeneralInventoryScanItem> = {}): GeneralInventoryScanItem {
  return {
    id: "item-1",
    sku: "SKU-1",
    codigoExterno: "7891234567890",
    codigoInterno: "INT-1",
    codigoExternoPack: null,
    quantidadeSistema: 5,
    quantidadeContada: null,
    atribuidoA: null,
    ...overrides,
  };
}

const USER = "user-a";
const OTHER_USER = "user-b";

test("findGeneralInventoryScanItem casa por sku, codigoExterno, codigoInterno e pack, ignorando formatação", () => {
  const items = [item({ id: "a", sku: "SKU-A" }), item({ id: "b", sku: "SKU-B", codigoExterno: "111 222" })];
  assert.equal(findGeneralInventoryScanItem(items, "sku-a")?.id, "a");
  assert.equal(findGeneralInventoryScanItem(items, "111-222")?.id, "b");
  assert.equal(findGeneralInventoryScanItem(items, "nada-aqui"), null);
});

test("código sem match -> not-found", () => {
  const state = { items: [item()], activeItemId: null, activeCount: 0, currentUserId: USER };
  assert.deepEqual(resolveGeneralInventoryScan("codigo-desconhecido", state), { kind: "not-found" });
});

test("item já reivindicado por outro operador -> claimed-by-other", () => {
  const claimed = item({ atribuidoA: OTHER_USER });
  const state = { items: [claimed], activeItemId: null, activeCount: 0, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.equal(decision.kind, "claimed-by-other");
});

test("primeiro bipe de um item novo -> switch-item, conta como unidade 1", () => {
  const target = item({ id: "novo", quantidadeSistema: 5, quantidadeContada: null });
  const state = { items: [target], activeItemId: null, activeCount: 0, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "switch-item", item: target, nextCount: 1, complete: false });
});

test("bipe do item ativo, abaixo do limite -> increment sem completar", () => {
  const active = item({ id: "ativo", quantidadeSistema: 5 });
  const state = { items: [active], activeItemId: "ativo", activeCount: 2, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "increment", item: active, nextCount: 3, complete: false });
});

test("bipe que fecha exatamente no limite -> increment com complete=true", () => {
  const active = item({ id: "ativo", quantidadeSistema: 5 });
  const state = { items: [active], activeItemId: "ativo", activeCount: 4, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "increment", item: active, nextCount: 5, complete: true });
});

test("bipe além do limite (item ativo já completo) -> surplus-prompt, sem incrementar", () => {
  const active = item({ id: "ativo", quantidadeSistema: 5 });
  const state = { items: [active], activeItemId: "ativo", activeCount: 5, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "surplus-prompt", item: active, switchingItem: false, seededCount: 5 });
});

test("trocar para um item cuja contagem já salva está no limite ou acima -> surplus-prompt na troca", () => {
  const target = item({ id: "outro", quantidadeSistema: 3, quantidadeContada: 3 });
  const state = { items: [target], activeItemId: "ativo-anterior", activeCount: 1, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "surplus-prompt", item: target, switchingItem: true, seededCount: 3 });
});

test("trocar para um item com quantidadeSistema=0 -> surplus-prompt imediato (não conta em silêncio)", () => {
  const target = item({ id: "zero-esperado", quantidadeSistema: 0, quantidadeContada: null });
  const state = { items: [target], activeItemId: "outro", activeCount: 0, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.deepEqual(decision, { kind: "surplus-prompt", item: target, switchingItem: true, seededCount: 0 });
});

test("reivindicado por mim mesmo não bloqueia (claimed-by-other só dispara para outro usuário)", () => {
  const mine = item({ atribuidoA: USER, quantidadeSistema: 5 });
  const state = { items: [mine], activeItemId: null, activeCount: 0, currentUserId: USER };
  const decision = resolveGeneralInventoryScan("SKU-1", state);
  assert.equal(decision.kind, "switch-item");
});
