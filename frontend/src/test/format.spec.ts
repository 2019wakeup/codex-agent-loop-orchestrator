import { describe, expect, it } from "vitest";

import { formatDuration, formatTokenEstimate, formatTokens, formatValue, labelize } from "../lib/format";

describe("format helpers", () => {
  it("formats numbers and empty values like the legacy dashboard", () => {
    expect(formatValue(null)).toBe("n/a");
    expect(formatValue(2)).toBe("2");
    expect(formatValue(0.71234)).toBe("0.712");
  });

  it("formats durations and token estimates", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(75)).toBe("1m 15s");
    expect(formatDuration(3725)).toBe("1h 2m");
    expect(formatTokens(1530)).toBe("1.5k");
    expect(formatTokenEstimate({ estimated_codex_tokens: 2400, token_budget_hint: 9000 })).toBe("2.4k / 9.0k");
  });

  it("turns machine labels into readable labels", () => {
    expect(labelize("waiting_callback")).toBe("waiting callback");
  });
});
