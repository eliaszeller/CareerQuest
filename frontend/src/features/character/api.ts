import type { CareerSuggestions } from "../careers/contract";
import { CharacterProfile, isCharacterProfile } from "./model";

export function validateResumeFile(file: File): string | null {
  if (!/\.(pdf|docx|txt)$/i.test(file.name)) return "Choose a PDF, DOCX, or TXT file.";
  if (!file.size) return "This file is empty. Choose another file or enter your details manually.";
  if (file.size > 5 * 1024 * 1024) return "Choose a file smaller than 5 MB.";
  return null;
}

async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 45000);
  try {
    const response = await fetch(`/api/v1/characters/${path}`, { ...init, signal: controller.signal, cache: "no-store" });
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error("The local API returned an unreadable response. Check that it is running and try again."); }
    if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Check your entries and try again.");
    return payload;
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Canceled", "AbortError");
    if (controller.signal.aborted) throw new Error("Processing took too long. Try a smaller document or continue manually.");
    if (error instanceof TypeError) throw new Error("We couldn’t reach the local API. Start the backend and try again. Your draft is still here.");
    throw error;
  } finally { window.clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}

export type ExtractionResult = { profile: CharacterProfile; warnings: string[]; careerSuggestions: CareerSuggestions | null };

function isCareerSuggestions(value: unknown): value is CareerSuggestions {
  const candidate = value as CareerSuggestions | null;
  return !!candidate && Array.isArray(candidate.categories) && Array.isArray(candidate.occupations) && typeof candidate.note === "string";
}

export async function extractResume(file: File, signal: AbortSignal): Promise<ExtractionResult> {
  const problem = validateResumeFile(file);
  if (problem) throw new Error(problem);
  const form = new FormData(); form.append("file", file);
  const result = await request("extract", { method: "POST", body: form }, signal) as { profile?: unknown; warnings?: unknown; career_suggestions?: unknown };
  if (!result || !isCharacterProfile(result.profile) || !Array.isArray(result.warnings)
    || !result.warnings.every((warning) => typeof warning === "string")) throw new Error("We couldn’t read the suggestions. Try again or continue manually.");
  // Suggestions are optional extras; a malformed block is dropped rather than failing the import.
  const careerSuggestions = isCareerSuggestions(result.career_suggestions) ? result.career_suggestions : null;
  return { profile: result.profile, warnings: result.warnings, careerSuggestions };
}

export async function approveProfile(profile: CharacterProfile, signal: AbortSignal): Promise<CharacterProfile> {
  const result = await request("approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }, signal);
  if (!isCharacterProfile(result) || result.approval_status !== "approved") throw new Error("Your character could not be confirmed. Please try again.");
  return result;
}
