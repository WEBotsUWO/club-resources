import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const webots = JSON.parse(
  readFileSync("webots/org-structure/chart.json", "utf8"),
);
const chrc = JSON.parse(readFileSync("chrc/org-structure/chart.json", "utf8"));

async function setup(page: Page, write = true) {
  const records = {
    webots: structuredClone(webots),
    chrc: structuredClone(chrc),
  };
  const writes: { club: string; body: any }[] = [];
  await page.route("https://api.github.com/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/user"))
      return route.fulfill({ json: { login: "test-editor" } });
    if (!url.includes("/contents/"))
      return route.fulfill({ json: { permissions: { push: write } } });
    const club = url.includes("/contents/chrc/") ? "chrc" : "webots";
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      writes.push({ club, body });
      records[club] = JSON.parse(
        Buffer.from(body.content, "base64").toString("utf8"),
      );
      return route.fulfill({ json: { content: { sha: "saved-sha" } } });
    }
    return route.fulfill({
      json: {
        encoding: "base64",
        sha: "initial-sha",
        content: Buffer.from(JSON.stringify(records[club])).toString("base64"),
      },
    });
  });
  return { records, writes };
}

async function connect(page: Page) {
  await page.getByRole("button", { name: "Edit chart", exact: true }).click();
  await page.getByLabel("GitHub token").fill("example-test-token");
  await page.getByRole("button", { name: "Connect editor" }).click();
}

test("public charts, contacts, branch controls, search, pan, and zoom", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { records } = await setup(page);
  records.webots.people[0].name = "Sample President";
  records.webots.people[0].email = "president@example.org";
  records.webots.people[0].discordUsername = "sample.president";
  records.webots.people[0].discordId = "123456789012345678";
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/webots/org-structure/?view=1");
  await expect(
    page.getByRole("heading", { name: "WeBots Organization" }),
  ).toBeVisible();
  await expect(page.locator(".person-card")).toHaveCount(5);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(
    page.getByLabel("Discord profile for Sample President"),
  ).toHaveAttribute("href", "https://discord.com/users/123456789012345678");
  await expect(page.getByLabel("Email Sample President")).toHaveAttribute(
    "href",
    "mailto:president%40example.org",
  );
  const initial = await page.locator(".org-svg > g").getAttribute("transform");
  await page.getByLabel("Zoom in", { exact: true }).click();
  expect(await page.locator(".org-svg > g").getAttribute("transform")).not.toBe(
    initial,
  );
  const box = await page.locator(".chart-scroll").boundingBox();
  const beforePan = await page
    .locator(".org-svg > g")
    .getAttribute("transform");
  await page.mouse.move(box!.x + 15, box!.y + 25);
  await page.mouse.down();
  await page.mouse.move(box!.x + 90, box!.y + 85, { steps: 5 });
  await page.mouse.up();
  expect(await page.locator(".org-svg > g").getAttribute("transform")).not.toBe(
    beforePan,
  );
  await page.getByLabel("Expand all branches").click();
  await expect(page.locator(".person-card")).toHaveCount(19);
  await page.getByLabel("Search by name or role").fill("no-such-role-xyz");
  await expect(page.getByText("No matching names or roles.")).toBeVisible();
  await page.getByLabel("Search by name or role").fill("Sample President");
  await expect(page.locator(".person-card")).toHaveCount(1);
  await page.getByLabel("Clear search").click();
  await page.getByLabel("Collapse branches").click();
  await page.screenshot({ path: "test-results/webots-desktop.png" });
  await page.getByRole("navigation").getByText("CHRC", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "CHRC President", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".person-card")).toHaveCount(6);
  await expect(
    page.getByRole("heading", { name: "VP Logistics", exact: true }),
  ).toHaveCount(2);
  await page.screenshot({ path: "test-results/chrc-desktop.png" });
  expect(errors).toEqual([]);
});

test("authorized editor publishes shared changes without storing credentials", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/chrc/org-structure/");
  await connect(page);
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.getByLabel("Person's name").fill("Renée Chen");
  await page.getByLabel("Email", { exact: true }).fill("renee@example.org");
  await page.getByLabel("Discord username", { exact: true }).fill("renee.chen");
  await page.getByLabel("Discord user ID").fill("123456789012345678");
  await page.getByLabel("Leadership color").fill("#00bb88");
  await expect(page.locator('[data-role-id="chrc-president"]')).toContainText(
    "Renée Chen",
  );
  await expect(
    page.locator('[data-role-id="chrc-president"] .senior-badge'),
  ).toContainText("Executive");
  expect(
    await page
      .locator('[data-role-id="chrc-president"]')
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--team-color"),
      ),
  ).toBe("#00bb88");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Published.");
  expect(writes).toHaveLength(1);
  expect(writes[0].club).toBe("chrc");
  expect(writes[0].body.sha).toBe("initial-sha");
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("example-test-token");
  await page.getByRole("button", { name: "Add report", exact: true }).click();
  await page.getByLabel("Role title").fill("New coordinator");
  await expect(
    page.getByRole("heading", { name: "New coordinator" }),
  ).toBeVisible();
  await page.getByLabel("Undo", { exact: true }).click();
  await expect(page.getByLabel("Role title")).toHaveValue("New role");
  await page.getByLabel("Redo", { exact: true }).click();
  await expect(page.getByLabel("Role title")).toHaveValue("New coordinator");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator(".person-card")).toHaveCount(6);
  await page.getByLabel("Disconnect editor").click();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.locator('[data-role-id="chrc-president"]')).toContainText(
    "Renée Chen",
  );
});

test("read-only users cannot edit, even with an edit query parameter", async ({
  page,
}) => {
  const { writes } = await setup(page, false);
  await page.goto("/webots/org-structure/?edit=1");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await connect(page);
  await expect(page.getByRole("alert")).toContainText("needs Write");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test("stale publish preserves draft and blocks a silent overwrite", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/webots/org-structure/");
  await connect(page);
  await page.getByLabel("Person's name").fill("Draft name");
  await page.route("**/contents/webots/org-structure/chart.json", (route) =>
    route.fulfill({ status: 409, json: { message: "Conflict" } }),
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("chart changed");
  await expect(page.getByLabel("Person's name")).toHaveValue("Draft name");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("club-resources:webots:draft-v1"),
    ),
  ).toContain("Draft name");
});

for (const club of ["webots", "chrc"])
  test(`${club} mobile and embed layouts`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${club}/org-structure/`);
    await expect(page.locator(".person-card").first()).toBeVisible();
    await expect(page.locator(".person-card").first()).toBeInViewport({
      ratio: 0.95,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    const bounds = await page.locator(".chart-scroll").boundingBox();
    expect(bounds!.height).toBeGreaterThan(400);
    await page.screenshot({ path: `test-results/${club}-mobile.png` });
    await page.goto(`/${club}/org-structure/?embed=1`);
    await expect(page.locator(".person-card").first()).toBeVisible();
    await expect(page.locator(".person-card").first()).toBeInViewport({
      ratio: 0.95,
    });
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByText("Edit chart", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `test-results/${club}-embed.png` });
  });
