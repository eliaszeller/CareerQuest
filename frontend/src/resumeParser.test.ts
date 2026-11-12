import { describe, expect, it } from "vitest";
import { buildLocalDraft, pdfTextToLines, processResumeLocally } from "./resumeParser";

describe("browser résumé processing", () => {
  it("extracts the candidate and ranks analytics skills", () => {
    const draft = buildLocalDraft([
      "ELIAS ZELLER",
      "elias@example.com",
      "EDUCATION",
      "Example University",
      "MS, Business Analytics",
      "TECHNICAL SKILLS",
      "Python (pandas), Excel (PivotTables), SQL, NLP, Sales",
    ].join("\n"));

    expect(draft.name).toBe("Elias Zeller");
    expect(draft.skills.slice(0, 3)).toEqual(["Python", "SQL", "Excel"]);
    expect(draft.skills.filter((skill) => skill.startsWith("Python"))).toHaveLength(1);
  });

  it("processes a TXT résumé without an API request", async () => {
    const file = new File(["JANE DOE\nEDUCATION\nState University\nSKILLS\nPython, SQL"], "resume.txt", { type: "text/plain" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("JANE DOE\nEDUCATION\nState University\nSKILLS\nPython, SQL").buffer,
    });
    const result = await processResumeLocally(file);

    expect(result.draft.name).toBe("Jane Doe");
    expect(result.draft.skills).toEqual(expect.arrayContaining(["Python", "SQL"]));
    expect(result.message).toContain("not uploaded");
  });

  it("reconstructs PDF rows before identifying résumé sections", () => {
    const lines = pdfTextToLines([
      { str: "EDUCATION", transform: [1, 0, 0, 1, 40, 700], hasEOL: true },
      { str: "University of Colorado Boulder", transform: [1, 0, 0, 1, 40, 680] },
      { str: "Boulder, CO", transform: [1, 0, 0, 1, 340, 680], hasEOL: true },
      { str: "EXPERIENCE", transform: [1, 0, 0, 1, 40, 640], hasEOL: true },
      { str: "Business Analyst Intern", transform: [1, 0, 0, 1, 40, 620], hasEOL: true },
      { str: "PROJECTS", transform: [1, 0, 0, 1, 40, 580], hasEOL: true },
      { str: "Analytics Dashboard", transform: [1, 0, 0, 1, 40, 560], hasEOL: true },
    ]);
    const draft = buildLocalDraft(lines.join("\n"));

    expect(lines).toEqual([
      "EDUCATION",
      "University of Colorado Boulder Boulder, CO",
      "EXPERIENCE",
      "Business Analyst Intern",
      "PROJECTS",
      "Analytics Dashboard",
    ]);
    expect(draft.education).toEqual(["University of Colorado Boulder Boulder, CO"]);
    expect(draft.experience).toEqual(["Business Analyst Intern"]);
    expect(draft.projects).toEqual(["Analytics Dashboard"]);
  });
});
