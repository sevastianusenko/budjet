import { describe, expect, it } from "vitest";
import { groupReceiptLines, type GroupableTx } from "./receipt-group";

const tx = (id: string, categoryId: string | null, receiptId: string | null, type: GroupableTx["type"] = "expense"): GroupableTx => ({
  id,
  type,
  receiptId,
  categoryId,
});

describe("groupReceiptLines", () => {
  it("merges one receipt's lines of the same category and keeps other categories apart", () => {
    const rows = groupReceiptLines([tx("a", "food", "r1"), tx("b", "home", "r1"), tx("c", "food", "r1"), tx("d", "food", "r1")]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "receipt", categoryId: "food" });
    expect(rows[0].kind === "receipt" && rows[0].txs.map((t) => t.id)).toEqual(["a", "c", "d"]);
    expect(rows[1]).toMatchObject({ kind: "receipt", categoryId: "home" });
  });

  it("does not merge across receipts and leaves ordinary entries alone", () => {
    const rows = groupReceiptLines([tx("a", "food", "r1"), tx("b", "food", "r2"), tx("c", "food", null), tx("d", null, "r1", "income")]);
    expect(rows.map((r) => r.kind)).toEqual(["receipt", "receipt", "tx", "tx"]);
  });
});
