import { describe, expect, it } from "vitest";
import { allPositionOnly, dimensionState, evidenceSummary, matchBadge } from "./ideologyConfidence";

describe("evidenceSummary", () => {
  it("counts each source, singular or plural", () => {
    expect(evidenceSummary({ stance: 3, debate: 1 })).toBe("3 stances · 1 debate speech");
    expect(evidenceSummary({ stance: 1, debate: 2 })).toBe("1 stance · 2 debate speeches");
  });

  it("is null when there is no evidence, and never shows a zero", () => {
    expect(evidenceSummary({})).toBeNull();
    expect(evidenceSummary({ stance: 0 })).toBeNull();
    expect(evidenceSummary({ stance: 0, debate: 2 })).toBe("2 debate speeches");
  });
});

describe("matchBadge", () => {
  it("says a match with no own evidence is only the party position", () => {
    expect(matchBadge("td", "none")).toEqual({ label: "Party position only", variant: "warn" });
    expect(matchBadge("party", "none")).toEqual({ label: "Estimated party position", variant: "warn" });
  });

  it("flags little evidence, and says nothing once there is enough", () => {
    expect(matchBadge("td", "low")).toEqual({ label: "Little evidence yet", variant: "warn" });
    expect(matchBadge("td", "medium")).toBeNull();
    expect(matchBadge("td", "high")).toBeNull();
    expect(matchBadge("party", "high")).toBeNull();
  });
});

describe("allPositionOnly", () => {
  it("is true only when every item has no own evidence", () => {
    expect(allPositionOnly([{ confidence: "none" }, { confidence: "none" }])).toBe(true);
    expect(allPositionOnly([{ confidence: "none" }, { confidence: "low" }])).toBe(false);
    expect(allPositionOnly([])).toBe(false);
  });
});

describe("dimensionState", () => {
  const measured = ["economic", "welfare"] as const;

  it("is measured where there is own evidence, whatever the baseline", () => {
    expect(dimensionState("economic", { measured, hasPartyBaseline: true })).toBe("measured");
    expect(dimensionState("welfare", { measured, hasPartyBaseline: false })).toBe("measured");
  });

  it("falls back to the party position, else says not measured", () => {
    expect(dimensionState("social", { measured, hasPartyBaseline: true })).toBe("party");
    expect(dimensionState("social", { measured, hasPartyBaseline: false })).toBe("not-measured");
  });
});
