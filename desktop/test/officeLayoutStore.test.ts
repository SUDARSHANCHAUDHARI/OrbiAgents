import assert from "node:assert/strict";
import test from "node:test";
import { defaultOfficeLayout, loadOfficeLayout, OFFICE_LAYOUT_STORAGE_KEY, saveOfficeLayout } from "../src/renderer/src/office/officeLayoutStore";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  let key: string | null = null;
  return { getItem: () => value, setItem: (nextKey: string, next: string) => { key = nextKey; value = next; }, key: () => key, value: () => value };
}

test("office layout persists the selected floor and an independent camera per floor", () => {
  const storage = memoryStorage();
  const layout = defaultOfficeLayout();
  layout.floorId = "engineering";
  layout.cameras.operations = { x: -96, y: 0, zoom: 1 };
  layout.cameras.engineering = { x: 0, y: -96, zoom: 2 };
  saveOfficeLayout(storage, layout);
  assert.deepEqual(loadOfficeLayout(storage), layout);
  assert.equal(storage.key(), OFFICE_LAYOUT_STORAGE_KEY);
  assert.equal(JSON.parse(storage.value() ?? "null").floorId, "engineering");
});

test("office layout fails closed for malformed and unbounded persisted values", () => {
  assert.deepEqual(loadOfficeLayout(memoryStorage("not-json")), defaultOfficeLayout());
  const storage = memoryStorage(JSON.stringify({ floorId: "support", cameras: { operations: { x: Infinity, y: 0, zoom: 1 }, engineering: { x: 20_000, y: 0, zoom: 2 }, support: { x: 48, y: -48, zoom: 2 } } }));
  const layout = loadOfficeLayout(storage);
  assert.deepEqual(layout.cameras.operations, { x: 0, y: 0, zoom: 1 });
  assert.deepEqual(layout.cameras.engineering, { x: 0, y: 0, zoom: 1 });
  assert.deepEqual(layout.cameras.support, { x: 48, y: -48, zoom: 2 });
});

test("office layout ignores storage read and write failures", () => {
  const failing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(loadOfficeLayout(failing), defaultOfficeLayout());
  assert.doesNotThrow(() => saveOfficeLayout(failing, defaultOfficeLayout()));
});
