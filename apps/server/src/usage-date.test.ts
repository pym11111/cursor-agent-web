import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usageDateKey } from "./usage-date.js";

describe("usageDateKey", () => {
  it("uses UTC+8 calendar day", () => {
    // 2026-08-03 22:00 UTC = 2026-08-04 06:00 UTC+8
    const key = usageDateKey(new Date("2026-08-03T22:00:00.000Z"));
    assert.equal(key, "2026-08-04");
  });

  it("keeps same day before UTC+8 midnight boundary", () => {
    // 2026-08-03 15:59 UTC = 2026-08-03 23:59 UTC+8
    const key = usageDateKey(new Date("2026-08-03T15:59:00.000Z"));
    assert.equal(key, "2026-08-03");
  });
});
