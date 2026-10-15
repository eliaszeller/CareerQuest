import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App, groupEducation, groupExperience, resolveOrganizationDomain } from "./App";

describe("landing page", () => {
  it("introduces CareerQuest and its four-step journey", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /build your character/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Four steps. Your choices." })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("opens onboarding and both character creation routes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /start your quest/i }));
    expect(screen.getByRole("heading", { name: /how would you like/i })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Build my character", { selector: "strong" }).closest("button")!);
    expect(screen.getByRole("heading", { name: /tell us where/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to options/i }));
    fireEvent.click(screen.getByText("Build from my résumé", { selector: "strong" }).closest("button")!);
    expect(screen.getByRole("heading", { name: /bring what you've already done/i })).toBeInTheDocument();
  });

  it("continues from manual setup to character selection", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /start your quest/i }));
    fireEvent.click(screen.getByText("Build my character", { selector: "strong" }).closest("button")!);

    fireEvent.change(screen.getByLabelText(/what should we call/i), { target: { value: "Jordan Lee" } });
    fireEvent.click(screen.getByRole("radio", { name: "College" }));
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(screen.getByRole("heading", { name: /choose your pathfinder/i })).toBeInTheDocument();
    expect(screen.getAllByText("Jordan Lee")).toHaveLength(2);
  });

  it("opens the interactive quest screen after character selection", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /start your quest/i }));
    fireEvent.click(screen.getByText("Build my character", { selector: "strong" }).closest("button")!);
    fireEvent.change(screen.getByLabelText(/what should we call/i), { target: { value: "Jordan Lee" } });
    fireEvent.click(screen.getByRole("radio", { name: "College" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /use this character/i }));

    expect(screen.getByRole("heading", { name: /choose your quest/i })).toBeInTheDocument();
    expect(screen.getByText(/jordan lee’s trail/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /earn a promotion/i }));
    expect(screen.getByRole("heading", { name: /earn a promotion/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /generate my 3 paths/i }));
    expect(screen.getByRole("heading", { name: /three ways up/i })).toBeInTheDocument();
    expect(document.querySelectorAll(".path-option")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /continue to simulation/i }));
    expect(screen.getByRole("heading", { name: /test your route/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /co-lead the project/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/build credibility/i);
    fireEvent.click(screen.getByRole("button", { name: /next decision/i }));
    expect(screen.getByText(/offer tradeoff/i)).toBeInTheDocument();
  });
});

describe("résumé education formatting", () => {
  it("groups institutions, locations, degrees, dates, and coursework", () => {
    expect(groupEducation([
      "University of Colorado Boulder - Leeds School of Business",
      "Boulder, CO",
      "MS, Business Analytics (Healthcare Analytics Focus)",
      "Expected May 2027",
      "Relevant coursework: Machine Learning in Python; NLP for Healthcare Analytics",
    ])).toEqual([{
      institution: "University of Colorado Boulder - Leeds School of Business",
      location: "Boulder, CO",
      degree: "MS, Business Analytics (Healthcare Analytics Focus)",
      date: "Exp May 2027",
      details: ["Relevant coursework: Machine Learning in Python; NLP for Healthcare Analytics"],
    }]);
  });
});

describe("résumé experience formatting", () => {
  it("groups employers and joins wrapped accomplishment lines", () => {
    expect(groupExperience([
      "Mike Maroone Automotive",
      "Colorado Springs, CO",
      "Business Analyst Intern",
      "• Analyze more than $100M in vehicle inventory and recommend actions",
      "to improve working capital and merchandising performance.",
      "\uf0b7 Integrate marketing spend and sales data to evaluate campaign ROI.",
    ])).toEqual([{
      company: "Mike Maroone Automotive",
      location: "Colorado Springs, CO",
      role: "Business Analyst Intern",
      accomplishments: [
        "Analyze more than $100M in vehicle inventory and recommend actions to improve working capital and merchandising performance.",
        "Integrate marketing spend and sales data to evaluate campaign ROI.",
      ],
    }]);
  });
});

describe("organization logo matching", () => {
  it("resolves known résumé organizations to official domains", () => {
    expect(resolveOrganizationDomain("University of Colorado Boulder - Leeds School of Business")).toBe("colorado.edu");
    expect(resolveOrganizationDomain("Mike Maroone Automotive")).toBe("mikemaroonecolorado.com");
    expect(resolveOrganizationDomain("Amazon")).toBe("amazon.com");
  });

  it("leaves unknown organizations for provider name lookup", () => {
    expect(resolveOrganizationDomain("A New Local Employer")).toBeNull();
  });
});
