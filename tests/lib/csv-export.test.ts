import { describe, it, expect } from "vitest";
import { rowsToCsv } from "../../lib/csv-export";

describe("rowsToCsv", () => {
  it("renders header and rows with BOM", () => {
    const csv = rowsToCsv(
      [{ name: "Joe", email: "j@x.com" }],
      [{ key: "name", label: "Name" }, { key: "email", label: "Email" }],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Name,Email\nJoe,j@x.com");
  });

  it("escapes commas and quotes", () => {
    const csv = rowsToCsv(
      [{ note: 'hello, "world"' }],
      [{ key: "note", label: "Note" }],
    );
    expect(csv).toContain('"hello, ""world"""');
  });
});
