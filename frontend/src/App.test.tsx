import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.unstubAllGlobals());

async function manualCharacter() {
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => ({ ok: true, json: async () => ({ ...JSON.parse(options.body), approval_status: "approved" }) })));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /start your quest/i }));
  fireEvent.click(screen.getByText("Build my character", { selector: "strong" }).closest("button")!);
  fireEvent.change(screen.getByLabelText(/what should we call/i), { target: { value: "Jordan Lee" } });
  fireEvent.click(screen.getByRole("radio", { name: "College" }));
  fireEvent.click(screen.getByRole("button", { name: /04 Review/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /reviewed my character/ }));
  fireEvent.click(screen.getByRole("button", { name: /confirm my character/i }));
  await screen.findByRole("heading", { name: /choose your pathfinder/i });
}

describe("landing page and unified onboarding", () => {
  it("introduces CareerQuest and its four-step journey", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /build your character/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Four steps. Your choices." })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("opens both routes into the same editor", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /start your quest/i }));
    fireEvent.click(screen.getByText("Build my character", { selector: "strong" }).closest("button")!);
    expect(screen.getByRole("heading", { name: /meet your next chapter/i })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /back to options/i })[0]);
    fireEvent.click(screen.getByText("Build from my résumé", { selector: "strong" }).closest("button")!);
    expect(screen.getByRole("heading", { name: /meet your next chapter/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/choose a résumé/i)).toBeInTheDocument();
  });

  it("approves a minimal manual profile and lets the user edit it later", async () => {
    await manualCharacter();
    expect(screen.getAllByText("Jordan Lee")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /edit my character/i }));
    expect(screen.getByRole("heading", { name: /make it yours/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit basics/i }));
    expect(screen.getByLabelText(/what should we call/i)).toHaveValue("Jordan Lee");
  });

  it("continues with a confirmed profile through the existing quest", async () => {
    await manualCharacter();
    fireEvent.click(screen.getByRole("button", { name: /use this character/i }));
    expect(screen.getByRole("heading", { name: /choose your quest/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /earn a promotion/i }));
    fireEvent.click(screen.getByRole("button", { name: /generate my 3 paths/i }));
    expect(document.querySelectorAll(".path-option")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /continue to simulation/i }));
    fireEvent.click(screen.getByRole("button", { name: /co-lead the project/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/build credibility/i);
    fireEvent.click(screen.getByRole("button", { name: /next decision/i }));
    expect(screen.getByText(/offer tradeoff/i)).toBeInTheDocument();
  });
});
