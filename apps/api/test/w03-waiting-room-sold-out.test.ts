import test from "node:test";
import assert from "node:assert/strict";

import {
  isSoldOutByInventory,
  type StockType,
} from "../src/waiting-room/waiting-room-inventory";

const standing = (soldCount: number, capacity = 5): StockType => ({
  id: "standing",
  isSeated: false,
  capacity,
  soldCount,
});
const seated = (soldCount: number): StockType => ({
  id: "seated",
  isSeated: true,
  capacity: 2,
  soldCount,
});

test("TC19: sold out for standing tickets", () => {
  assert.equal(isSoldOutByInventory([standing(5)], []), true);
  assert.equal(isSoldOutByInventory([standing(4)], []), false);
});

test("TC19: all ticket types must be sold out", () => {
  assert.equal(
    isSoldOutByInventory(
      [standing(5), seated(0)],
      [{ ticketTypeId: "seated", total: 2, unsold: 1 }],
    ),
    false,
  );
  assert.equal(
    isSoldOutByInventory(
      [standing(5), seated(0)],
      [{ ticketTypeId: "seated", total: 2, unsold: 0 }],
    ),
    true,
  );
});

test("TC19: seated inventory uses seat statuses, not only sold_count", () => {
  assert.equal(
    isSoldOutByInventory(
      [seated(0)],
      [{ ticketTypeId: "seated", total: 2, unsold: 0 }],
    ),
    true,
  );
  // Giu cho HELD chua phai SOLD_OUT.
  assert.equal(
    isSoldOutByInventory(
      [seated(0)],
      [{ ticketTypeId: "seated", total: 2, unsold: 1 }],
    ),
    false,
  );
});

test("TC19: no ticket types keeps existing waiting room behavior", () => {
  assert.equal(isSoldOutByInventory([], []), false);
});
