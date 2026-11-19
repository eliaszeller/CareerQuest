import { expect, Page, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(fonts\.googleapis|fonts\.gstatic)/, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Start your quest" }).click();
});
async function start(page: Page, resume = false) {
  await page.getByRole("button", { name: resume ? /Faster start Build from my résumé/ : /Recommended Build my character/ }).click();
}
async function basics(page: Page) {
  await page.getByLabel(/what should we call/i).fill("Jordan");
  await page.getByRole("radio", { name: "High school" }).check();
}
async function add(page: Page, category: string, title: string, details = "") {
  await page.getByRole("button", { name: `+ Add ${category}`, exact: true }).click();
  await page.getByLabel(new RegExp(`^${category} name$`, "i")).fill(title);
  if (details) await page.getByLabel("Details (optional)", { exact: false }).fill(details);
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
}
async function approve(page: Page) {
  await page.getByRole("checkbox", { name: /reviewed my character/ }).check();
  await page.getByRole("button", { name: /Confirm my character/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your pathfinder." })).toBeVisible();
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("manual student completes all categories, reviews, downloads, and edits", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await start(page); await basics(page);
  await page.getByLabel(/what would you like to figure out/i).fill("I want to combine creativity with helping my community.");
  await accessible(page);
  await page.screenshot({ path: info.outputPath("starting-point.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await add(page, "education", "Central High School", "Exploring science and design.");
  await add(page, "experience", "Community garden volunteer", "Helped organize a planting day with six classmates.");
  await add(page, "class", "Biology");
  await add(page, "project", "School recycling tracker", "Made a spreadsheet to track our weekly recycling.");
  await accessible(page);
  await page.screenshot({ path: info.outputPath("your-story.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await add(page, "interest", "Environmental science"); await add(page, "hobby", "Drawing");
  await add(page, "skill", "Spreadsheets", "Practiced formulas in a school project."); await add(page, "certification", "First Aid");
  await accessible(page);
  await page.getByRole("button", { name: /Review my character/ }).click();
  await accessible(page);
  await expect(page.getByRole("button", { name: /Confirm my character/ })).toBeDisabled();
  await page.screenshot({ path: info.outputPath("review.png"), fullPage: true });
  const request = page.waitForRequest("**/api/v1/characters/approve");
  await approve(page);
  const submitted = (await request).postDataJSON();
  expect(submitted.schema_version).toBe("2.0"); expect(submitted.entries).toHaveLength(8);
  expect(submitted.entries.every((entry: { status: string; source: string }) => entry.status === "confirmed" && entry.source === "manual")).toBe(true);
  await expect(page.getByText("Drawing", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download my profile" }).click();
  expect((await download).suggestedFilename()).toBe("careerquest-character.json");
  await page.getByRole("button", { name: /Edit my character/ }).click();
  await page.getByRole("button", { name: "Edit Drawing", exact: true }).click();
  await page.getByLabel("Hobby name").fill("Illustration"); await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await approve(page);
  await expect(page.getByText("Illustration", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("real résumé extraction feeds the same reviewable character", async ({ page }, info) => {
  await start(page, true);
  await page.locator("#resume-file").setInputFiles({ name: "synthetic-resume.txt", mimeType: "text/plain", buffer: Buffer.from("Jordan Rivera\njordan@example.invalid\nEDUCATION\nCentral High School\nEXPERIENCE\nCommunity Garden Volunteer\nHelped organize a planting day.\nSKILLS\nExcel, Python\nPROJECTS\nRecycling tracker\n") });
  await expect(page.getByRole("button", { name: "Extract suggestions" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /Process this file/ }).check();
  await page.getByRole("button", { name: "Extract suggestions" }).click();
  await expect(page.getByText(/5 new suggestions added/)).toBeVisible();
  await expect(page.getByLabel(/what should we call/i)).toHaveValue("Jordan Rivera");
  await page.getByRole("radio", { name: "College", exact: true }).check();
  await page.getByRole("button", { name: /04 Review/ }).click();
  await expect(page.getByText("5 suggestions need your review")).toBeVisible();
  await accessible(page);
  await page.screenshot({ path: info.outputPath("resume-review.png"), fullPage: true });
  await page.getByRole("button", { name: "Edit Python", exact: true }).click();
  await page.getByLabel("Skill name").fill("Python basics");
  await page.getByRole("button", { name: "Save & confirm" }).click();
  await page.getByRole("button", { name: "Remove Excel", exact: true }).click();
  await page.getByRole("button", { name: /I’ve checked all remaining/ }).click();
  await add(page, "hobby", "Cycling");
  await approve(page);
  await expect(page.getByText("Python basics", { exact: true })).toBeVisible();
  await expect(page.getByText("Cycling", { exact: true })).toBeVisible();
});

test("unreadable upload leaves manual entry usable", async ({ page }) => {
  await start(page, true); await basics(page);
  await page.locator("#resume-file").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not really a pdf") });
  await page.getByRole("checkbox", { name: /Process this file/ }).check();
  await page.getByRole("button", { name: "Extract suggestions" }).click();
  await expect(page.getByRole("alert")).toContainText("does not match");
  await page.getByRole("button", { name: /04 Review/ }).click();
  await approve(page);
});

test("failed approval preserves the draft for a real API retry", async ({ page }) => {
  await start(page); await basics(page);
  await page.getByRole("button", { name: /04 Review/ }).click();
  await page.route("**/api/v1/characters/approve", (route) => route.abort(), { times: 1 });
  await page.getByRole("checkbox", { name: /reviewed my character/ }).check();
  await page.getByRole("button", { name: /Confirm my character/ }).click();
  await expect(page.getByRole("alert")).toContainText("Your draft is still here");
  await approve(page);
});

test("keyboard entry, cancellation, and explicit reset", async ({ page }) => {
  await start(page); await basics(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "+ Add project", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByLabel("Project name")).toBeFocused();
  await page.keyboard.type("Unsaved draft");
  await expect(page.getByRole("button", { name: "Start your quest" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel edit" }).click();
  await page.getByRole("button", { name: "Clear this draft" }).click();
  await page.getByRole("button", { name: "Keep my draft" }).click();
  await expect(page.getByText("Jordan", { exact: true })).toBeAttached();
  await page.getByRole("button", { name: "Clear this draft" }).click();
  await page.getByRole("button", { name: "Yes, clear everything" }).click();
  await expect(page.getByLabel(/what should we call/i)).toHaveValue("");
});
