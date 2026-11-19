import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { approvalIssues, CharacterEntry, emptyProfile, isCharacterProfile, mergeResume } from "./model";
import { validateResumeFile } from "./api";

afterEach(() => vi.unstubAllGlobals());

function start(resume = false) {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /start your quest/i }));
  fireEvent.click(screen.getByText(resume ? "Build from my résumé" : "Build my character", { selector: "strong" }).closest("button")!);
}
function basics() {
  fireEvent.change(screen.getByLabelText(/what should we call/i), { target: { value: "Sam" } });
  fireEvent.click(screen.getByRole("radio", { name: "High school" }));
}
function add(category: string, name: string) {
  fireEvent.click(screen.getByRole("button", { name: `+ Add ${category}` }));
  fireEvent.change(screen.getByLabelText(new RegExp(`${category} name`, "i")), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
}
const suggestion = (title: string): CharacterEntry => ({ id: crypto.randomUUID(), category: "skills", title, details: "", source: "resume", status: "suggested", evidence: `Skills: ${title}` });

describe("character editor", () => {
  it("requires basics but allows every experience section to be skipped", () => {
    start(); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/name and choose/i);
    basics(); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: /more than a résumé/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: /review my character/i }));
    expect(screen.getByText(/a name and starting point are enough/i)).toBeInTheDocument();
  });

  it("keeps classes, hobbies, projects, and interests across steps and supports undo", () => {
    start(); basics(); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    add("class", "Biology"); add("project", "School garden");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    add("interest", "Ecology"); add("hobby", "Drawing");
    fireEvent.click(screen.getByRole("button", { name: "Remove Drawing" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: /review my character/i }));
    for (const title of ["Biology", "School garden", "Ecology", "Drawing"]) expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("protects unsaved entries and does not submit blank titles", () => {
    start(); basics(); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Add project" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /start your quest/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Save entry" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("clears a draft only after explicit confirmation", () => {
    start(); basics(); fireEvent.click(screen.getByRole("button", { name: "Clear this draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep my draft" }));
    expect(screen.getByLabelText(/what should we call/i)).toHaveValue("Sam");
    fireEvent.click(screen.getByRole("button", { name: "Clear this draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, clear everything" }));
    expect(screen.getByLabelText(/what should we call/i)).toHaveValue("");
  });

  it("preserves the draft when approval fails and supports retry", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("network"))
      .mockImplementationOnce(async (_url, options) => ({ ok: true, json: async () => ({ ...JSON.parse(options.body), approval_status: "approved" }) }));
    vi.stubGlobal("fetch", fetcher);
    start(); basics(); fireEvent.click(screen.getByRole("button", { name: /04 Review/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /reviewed my character/ }));
    fireEvent.click(screen.getByRole("button", { name: /confirm my character/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/draft is still here/i);
    fireEvent.click(screen.getByRole("button", { name: /confirm my character/i }));
    expect(await screen.findByRole("heading", { name: /choose your pathfinder/i })).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("imports suggestions, requires review, and preserves corrected entries", async () => {
    const imported = { ...emptyProfile(), name: "Imported Name", entries: [suggestion("Python"), suggestion("Excel")] };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ profile: imported, warnings: [] }) })));
    start(true); basics();
    fireEvent.change(screen.getByLabelText(/choose a résumé/i), { target: { files: [new File(["SKILLS\nPython"], "resume.txt")] } });
    fireEvent.click(screen.getByRole("checkbox", { name: /process this file/i }));
    fireEvent.click(screen.getByRole("button", { name: "Extract suggestions" }));
    await screen.findByText(/2 new suggestions added/i);
    expect(screen.getByLabelText(/what should we call/i)).toHaveValue("Sam");
    fireEvent.click(screen.getByRole("button", { name: /04 Review/ }));
    expect(screen.getByRole("button", { name: /confirm my character/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit Python" }));
    fireEvent.change(screen.getByLabelText("Skill name"), { target: { value: "Python basics" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Excel" }));
    expect(screen.getByText(/all entries are confirmed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /reviewed my character/ }));
    expect(screen.getByRole("button", { name: /confirm my character/i })).toBeEnabled();
    const section = screen.getByRole("region", { name: "Skills" });
    expect(within(section).getByRole("heading", { name: "Python basics" })).toBeInTheDocument();
  });

  it("rejects unsupported files before making a request", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); start(true);
    fireEvent.change(screen.getByLabelText(/choose a résumé/i), { target: { files: [new File(["image"], "image.png")] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/PDF, DOCX, or TXT/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows optional career suggestions from the résumé", async () => {
    const career_suggestions = {
      categories: [{ category: "HEALTHCARE", label: "Healthcare", confidence: 0.81, model_version: "v1" }, { category: "FITNESS", label: "Fitness", confidence: 0.1, model_version: "v1" }],
      occupations: [{ soc: "29-1141.00", title: "Registered Nurses", score: 0.4, reason: "similar_wording" }],
      note: "Starting points to explore, not a judgment of your fit or ability.",
      source: { name: "O*NET 31.0 Database", version: "31.0", license: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0/", attribution: "Includes information from the O*NET 31.0 Database." },
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ profile: emptyProfile(), warnings: [], career_suggestions }) })));
    start(true); basics();
    fireEvent.change(screen.getByLabelText(/choose a résumé/i), { target: { files: [new File(["Nurse"], "resume.txt")] } });
    fireEvent.click(screen.getByRole("checkbox", { name: /process this file/i }));
    fireEvent.click(screen.getByRole("button", { name: "Extract suggestions" }));
    const panel = await screen.findByRole("region", { name: /where your résumé points/i });
    expect(within(panel).getByText("Healthcare")).toBeInTheDocument();
    expect(within(panel).getByText(/81% match; also Fitness/)).toBeInTheDocument();
    expect(within(panel).getByText("Registered Nurses")).toBeInTheDocument();
    expect(within(panel).getByText(/O\*NET 31.0 Database/)).toBeInTheDocument();
  });

  it("ignores an extraction that finishes after the user cancels", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((done) => { resolve = done; })));
    start(true); basics();
    fireEvent.change(screen.getByLabelText(/choose a résumé/i), { target: { files: [new File(["SKILLS"], "resume.txt")] } });
    fireEvent.click(screen.getByRole("checkbox", { name: /process this file/i }));
    fireEvent.click(screen.getByRole("button", { name: "Extract suggestions" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
    resolve({ ok: true, json: async () => ({ profile: { ...emptyProfile(), entries: [suggestion("Stale")] }, warnings: [] }) });
    await waitFor(() => expect(screen.getByRole("button", { name: "Extract suggestions" })).toBeEnabled());
    expect(screen.queryByText(/new suggestions added/i)).not.toBeInTheDocument();
  });
});

describe("shared character model", () => {
  it("merges without overwriting confirmed entries or duplicating reimports", () => {
    const original = { ...emptyProfile(), name: "My name", entries: [{ ...suggestion("Python"), status: "confirmed" as const }] };
    const imported = { ...emptyProfile(), name: "Another name", entries: [suggestion("Python"), suggestion("Excel")] };
    const result = mergeResume(original, imported);
    expect(result.added).toBe(1);
    expect(result.profile.entries[0].status).toBe("confirmed");
    expect(result.profile.name).toBe("My name");
    expect(mergeResume(result.profile, imported).added).toBe(0);
  });
  it("requires explicit review and enforces the import capacity", () => {
    expect(approvalIssues({ ...emptyProfile(), name: "Sam", life_stage: "high_school", entries: [suggestion("Excel")] })).toHaveLength(1);
    const full = { ...emptyProfile(), entries: Array.from({ length: 200 }, (_, n) => suggestion(`Skill ${n}`)) };
    expect(mergeResume(full, { ...emptyProfile(), entries: [suggestion("New")] }).omitted).toBe(1);
    expect(isCharacterProfile({ ...full, entries: [...full.entries, suggestion("Extra")] })).toBe(false);
  });
  it("validates file limits and response shape", () => {
    expect(validateResumeFile(new File([], "empty.txt"))).toMatch(/empty/);
    expect(validateResumeFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.txt"))).toMatch(/5 MB/);
    expect(isCharacterProfile(emptyProfile())).toBe(true);
    expect(isCharacterProfile({ ...emptyProfile(), entries: [null] })).toBe(false);
  });
});
