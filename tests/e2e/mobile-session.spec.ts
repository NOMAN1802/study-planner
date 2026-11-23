import { devices, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E_PASSWORD, signUp, uniqueEmail } from "./helpers";

// A phone: small screen, touch, mobile user agent.
test.use({ ...devices["Pixel 7"] });

const PAGES = [
  ["Tasks", "/tasks"],
  ["Settings", "/settings"],
  ["Planner", "/planner"],
  ["Dashboard", "/dashboard"],
] as const;

/**
 * Marks the stored session as expired, as it is when a phone comes back to the
 * app after the access token's lifetime: the next request has to refresh it.
 */
async function expireSession(context: BrowserContext) {
  const all = await context.cookies();
  const parts = all
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  expect(parts.length, "session cookie").toBeGreaterThan(0);
  const raw = parts.map((c) => c.value).join("");
  const session = JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString());
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const base = parts[0].name.replace(/\.\d+$/, "");
  await context.clearCookies({ name: new RegExp(`^${base}`) });
  const size = 3180;
  const chunks = value.length <= size ? [value] : value.match(new RegExp(`.{1,${size}}`, "g"))!;
  await context.addCookies(
    chunks.map((v, i) => ({
      ...parts[0],
      name: chunks.length === 1 ? base : `${base}.${i}`,
      value: v,
    })),
  );
}

async function signInOnPhone(page: Page) {
  const email = uniqueEmail("mobile");
  await signUp(page, email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function openFromMenu(page: Page, name: string) {
  await page.getByRole("button", { name: "Open menu" }).tap();
  await page.getByRole("navigation").getByRole("link", { name, exact: true }).tap();
}

test("mobile: signing in and moving between pages keeps the session", async ({ page }) => {
  test.setTimeout(120_000);
  await signInOnPhone(page);
  for (const [name, path] of PAGES) {
    await openFromMenu(page, name);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("mobile: an expired session is refreshed, not lost, when moving between pages", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await signInOnPhone(page);
  for (const [name, path] of PAGES) {
    await expireSession(context);
    await openFromMenu(page, name);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    // Wait past Supabase's refresh-token reuse window, so a token the browser
    // never received would now count as reused and end the session.
    await page.waitForTimeout(11_000);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});
