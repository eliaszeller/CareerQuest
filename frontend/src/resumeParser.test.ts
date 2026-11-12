import { describe, expect, it } from "vitest";
import { buildLocalDraft, processResumeLocally } from "./resumeParser";

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
});
