import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketPanel } from "./MarketPanel";

const source = { name: "O*NET 31.0 Database", version: "31.0", license: "CC BY 4.0", license_url: "", attribution: "Includes O*NET 31.0 data." };
const postingsSource = { ...source, name: "LinkedIn Job Postings", license: "CC BY-SA 4.0", attribution: "Derived from LinkedIn Job Postings." };
const detail = {
  soc: "15-2051.00", title: "Data Scientists", description: "", alternate_titles: [], job_zone: { zone: 4, name: "Job Zone Four: Considerable Preparation Needed", education: null, experience: null, training: null },
  essential_skills: [], transferable_skills: [], knowledge: [], software: [], related: [], source,
  market: { postings: 1234, salary: { postings_with_salary: 400, p25: 110000, median: 130000, p75: 155000 }, preferred_skills: [], source: postingsSource,
    sample_postings: [{ job_id: "1", soc: "15-2051.00", title: "Senior Data Scientist", company: "Acme", location: "Remote", experience_level: null, work_type: null, salary_annual: 150000, listed_date: "2024-04-01", url: "https://example.com/1", snippet: "", score: null }] },
};
const gap = {
  soc: "15-2051.00", title: "Data Scientists", coverage: 0.5, note: "Matches are names only.", sources: [source, postingsSource],
  items: [
    { name: "Python", kind: "software", have: true, matched_by: "Python", detail: "in demand" },
    { name: "Mathematics", kind: "required", have: false, matched_by: null, detail: "O*NET importance 4.2 of 5" },
  ],
};

const explanation = {
  soc: "15-2051.00", title: "Data Scientists", summary: "Data science builds on what you already do.", generated_by: "model", model: "Qwen", note: "Each point cites the facts it rests on.", sources: [source],
  facts: [{ id: "F1", text: "Skills not yet in your profile: Mathematics.", source: "Skill gap check" }],
  points: [{ text: "Mathematics is the main gap to close.", facts: ["F1"] }],
};

function respond(body: unknown, status = 200) { return { ok: status < 400, status, json: async () => body }; }

afterEach(() => vi.unstubAllGlobals());

describe("MarketPanel", () => {
  it("shows real pay, skill match, gaps and sample postings", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("search")) return respond({ query: "x", results: [{ soc: "15-2051.00", title: "Data Scientists", job_zone: 4, matched_title: "Data Scientists" }], source });
      if (url.endsWith("/gap")) return respond(gap);
      if (url.endsWith("/explain")) return respond(explanation);
      return respond(detail);
    }));
    const onSalaryRange = vi.fn();
    render(<MarketPanel role="Data Scientist" skills={["Python"]} goal="Change careers" onSalaryRange={onSalaryRange} />);
    const panel = await screen.findByRole("region", { name: /real-world check: data scientists/i });
    expect(within(panel).getByText("1,234")).toBeInTheDocument();
    expect(within(panel).getByText("$110K–$155K")).toBeInTheDocument();
    expect(within(panel).getByText("50%")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Senior Data Scientist" })).toHaveAttribute("href", "https://example.com/1");
    expect(within(panel).getByText(/Mathematics/)).toBeInTheDocument();
    expect(within(panel).getByText("Derived from LinkedIn Job Postings.")).toBeInTheDocument();
    expect(onSalaryRange).toHaveBeenCalledWith("$110K–$155K");
    expect(await within(panel).findByText("Data science builds on what you already do.")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "F1" })).toHaveAttribute("title", "Skills not yet in your profile: Mathematics.");
    const explainCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/explain"));
    expect(JSON.parse(String(explainCall?.[1]?.body))).toEqual({ soc: "15-2051.00", skills: ["Python"], goal: "Change careers" });
  });

  it("explains when career data is not built", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond({ detail: "not built" }, 503)));
    const onSalaryRange = vi.fn();
    render(<MarketPanel role="Nurse" skills={[]} onSalaryRange={onSalaryRange} />);
    expect(await screen.findByText(/isn’t built yet/)).toBeInTheDocument();
    expect(onSalaryRange).toHaveBeenCalledWith(null);
  });
});
