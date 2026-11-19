import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("survey preserves responses, shows seven directions, and supports review", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Career survey", exact: true }).click();
  await expect(page.getByAltText(/John Business/)).toBeVisible();
  await page.getByRole("button", { name: "Next section" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose a response");
  for (let section = 0; section < 6; section++) {
    const groups = page.locator("fieldset");
    for (let q = 0; q < 5; q++) await groups.nth(q).getByRole("radio", { name: "Neutral", exact: true }).check();
    if (section === 0) {
      await page.getByRole("button", { name: "Return to my journey" }).click();
      await page.getByRole("button", { name: "Career survey", exact: true }).click();
      await expect(page.getByRole("radio", { name: "Neutral", exact: true }).first()).toBeChecked();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath("survey-questions.png"), fullPage: true });
    }
    await page.getByRole("button", { name: section === 5 ? "See my directions" : "Next section" }).click();
  }
  await expect(page.getByRole("heading", { name: "Your next directions." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /no clear direction yet/ })).toBeVisible();
  await expect(page.locator(".survey-career")).toHaveCount(7);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("survey-results.png"), fullPage: true });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my survey" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("careerquest-survey.json");
  await page.getByRole("button", { name: "Review my answers" }).click();
  await expect(page.getByRole("radio", { name: "Neutral", exact: true }).first()).toBeChecked();
  for (let section = 0; section < 6; section++) {
    await page.locator("fieldset").first().getByRole("radio", { name: "Not sure yet", exact: true }).check();
    await page.getByRole("button", { name: section === 5 ? "See my directions" : "Next section" }).click();
  }
  await expect(page.getByText("24 rated · 6 marked not sure")).toBeVisible();
  await page.getByRole("button", { name: "Explore Education" }).click();
  await expect(page.getByText("Exploring Education.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How would you like to build your character?" })).toBeVisible();
  await page.getByRole("button", { name: /Recommended Build my character/ }).click();
  await page.getByLabel(/what should we call/i).fill("Taylor");
  await page.getByRole("radio", { name: "High school" }).check();
  await page.getByRole("button", { name: /04 Review/ }).click();
  await page.getByRole("checkbox", { name: /reviewed my character/ }).check();
  await page.getByRole("button", { name: /Confirm my character/ }).click();
  await page.getByRole("button", { name: /Use this character/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your quest." })).toBeVisible();
  await expect(page.getByText("Instructional Designer", { exact: true })).toBeVisible();
});
