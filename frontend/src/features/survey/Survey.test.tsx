import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Survey, SurveyState } from "./Survey";

afterEach(() => vi.unstubAllGlobals());
it("keeps a completed draft available after the API fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  const state: SurveyState = { answers: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`q${String(i + 1).padStart(2, "0")}`, null])), step: 5, result: null };
  const onChange = vi.fn();
  render(<Survey state={state} onChange={onChange} onExit={vi.fn()} onChoose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /See my directions/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are still here");
  await waitFor(() => expect(screen.getByRole("button", { name: /See my directions/ })).toBeEnabled());
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getAllByRole("radio", { name: "Not sure yet" }).every(input => (input as HTMLInputElement).checked)).toBe(true);
});
