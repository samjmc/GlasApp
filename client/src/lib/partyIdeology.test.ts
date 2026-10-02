import { describe, expect, it } from "vitest";
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector } from "@shared/ideology";
import type { PartyAnswers, PartyIdeology, PartyQuizAnswer } from "@shared/ideologyMatch";
import { QUIZ_QUESTIONS } from "@shared/quiz";
import { partyIdeologyView, partySource } from "./partyIdeology";

const SF: PartyIdeology = {
  party: "Sinn Féin",
  vector: { economic: -6, social: -2, cultural: 1, authority: 5, environmental: -3, welfare: -7, globalism: 3, technocratic: 0 },
  tdMean: { economic: -6, social: -2, cultural: 1, authority: 5, environmental: -3, welfare: -7, globalism: 3, technocratic: 0 },
  tdCount: 3,
  computedAt: "2026-09-20T10:00:00.000Z",
  hasPartyBaseline: true,
  measured: [...IDEOLOGY_DIMENSIONS],
  manifesto: null,
};

const question = QUIZ_QUESTIONS[0]!;
const answer = (over: Partial<PartyQuizAnswer>): PartyQuizAnswer => ({
  party: "Sinn Féin", questionId: question.id, answered: true, answerIndex: 1, value: question.answers[1]!.value,
  rationale: "Says so.", abstainReason: null, modelConfidence: 0.8,
  citations: [{ document: "sf-ge2024", title: "The Choice for Change", url: "https://x", pdfPage: null, page: "4", href: "https://x#:~:text=We", quote: "We will do it." }],
  ...over,
});
const ANSWERS: PartyAnswers = {
  party: "Sinn Féin", election: "ge2024", documents: [{ slug: "sf-ge2024", title: "The Choice for Change", url: "https://x" }],
  position: { vector: emptyIdeologyVector(), coverage: { ...emptyIdeologyVector(), economic: 0.4 }, answeredCount: 2, askedCount: 26 },
  pendingCount: 0,
  answers: [answer({}), answer({ questionId: QUIZ_QUESTIONS[1]!.id, answered: false, answerIndex: null, value: null, abstainReason: "silent", citations: [] })],
};

describe("partyIdeologyView", () => {
  it("gives one row per dimension, labelled from DIMENSION_POLES with the sign the server uses", () => {
    const view = partyIdeologyView(SF, null)!;
    expect(view.rows.map((r) => r.dimension)).toEqual([...IDEOLOGY_DIMENSIONS]);
    // −7 on welfare is the expand-welfare pole, not "self-reliance".
    expect(view.rows.find((r) => r.dimension === "welfare")).toMatchObject({
      label: "Welfare", negative: "Expand welfare", positive: "Self-reliance", value: -7,
      description: "Strongly Expand welfare", measured: true, manifestoShare: 0,
    });
    expect(view.rows.find((r) => r.dimension === "authority")!.description).toBe("Moderately Authoritarian");
    expect(view.source).toBe("3 TDs");
    expect(view.manifesto).toBeNull();
    expect(view.answers).toEqual([]);
  });

  it("says nothing about a dimension a party with no baseline has not measured", () => {
    const view = partyIdeologyView({ ...SF, hasPartyBaseline: false, measured: ["economic"] }, null)!;
    expect(view.rows.find((r) => r.dimension === "economic")).toMatchObject({ measured: true, description: "Moderately Collective" });
    expect(view.rows.find((r) => r.dimension === "social")).toMatchObject({ measured: false, description: null });
  });

  it("adds the manifesto: its share per dimension, its coverage and its answered questions with their quotes", () => {
    const view = partyIdeologyView({ ...SF, manifesto: { coverage: { ...emptyIdeologyVector(), economic: 0.4 }, answeredCount: 2 } }, ANSWERS)!;
    expect(view.rows.find((r) => r.dimension === "economic")!.manifestoShare).toBe(0.4);
    expect(view.source).toBe("3 TDs + manifesto");
    expect(view.manifesto).toEqual({ answeredCount: 2, askedCount: 26 });
    expect(view.answers).toEqual([{
      questionId: question.id, question: question.text, answer: question.answers[1]!.text, rationale: "Says so.",
      citations: ANSWERS.answers[0]!.citations,
    }]);
  });

  it("is null, the empty state, when the party has no position", () => {
    expect(partyIdeologyView(null, ANSWERS)).toBeNull();
  });
});

describe("partySource", () => {
  it("counts TDs and names the manifesto when it is part of the position", () => {
    expect(partySource(1, false)).toBe("1 TD");
    expect(partySource(4, true)).toBe("4 TDs + manifesto");
  });
});
