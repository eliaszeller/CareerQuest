import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sources } from "./Sources";

describe("Sources", () => {
  it("credits every dataset with its license", () => {
    render(<Sources onBack={vi.fn()} />);
    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apache 2.0" })).toBeInTheDocument();
    expect(screen.getByText(/USDOL\/ETA has not approved, endorsed, or tested/)).toBeInTheDocument();
    expect(screen.getByText(/not redistributed/)).toBeInTheDocument();
  });
});
