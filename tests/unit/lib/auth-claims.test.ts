import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { isTransientAuthError, readClaims } from "@/lib/supabase/claims";

type GetClaims = () => Promise<{ data: { claims: object } | null; error: unknown }>;

function client(getClaims: GetClaims) {
  return { auth: { getClaims: vi.fn(getClaims) } } as unknown as SupabaseClient & {
    auth: { getClaims: ReturnType<typeof vi.fn> };
  };
}

const ok = { data: { claims: { sub: "u1", email: "a@b.c" } }, error: null };
const networkError = Object.assign(new Error("fetch failed"), {
  name: "AuthRetryableFetchError",
  status: 0,
});
const reused = Object.assign(new Error("Invalid Refresh Token: Already Used"), {
  name: "AuthApiError",
  status: 400,
});

describe("isTransientAuthError", () => {
  it("treats network failures, timeouts and 5xx as transient", () => {
    expect(isTransientAuthError(networkError)).toBe(true);
    expect(isTransientAuthError({ name: "AuthApiError", status: 503 })).toBe(true);
    expect(isTransientAuthError(new TypeError("fetch failed"))).toBe(true);
  });

  it("treats a rejected session as final", () => {
    expect(isTransientAuthError(reused)).toBe(false);
    expect(isTransientAuthError({ name: "AuthSessionMissingError", status: 400 })).toBe(false);
    expect(isTransientAuthError(null)).toBe(false);
  });
});

describe("readClaims", () => {
  it("returns the claims on the first try", async () => {
    const c = client(async () => ok);
    await expect(readClaims(c)).resolves.toEqual({ claims: ok.data.claims, error: null });
    expect(c.auth.getClaims).toHaveBeenCalledTimes(1);
  });

  it("retries once after a network blip", async () => {
    const results = [{ data: null, error: networkError }, ok];
    const c = client(async () => results.shift()!);
    await expect(readClaims(c)).resolves.toEqual({ claims: ok.data.claims, error: null });
    expect(c.auth.getClaims).toHaveBeenCalledTimes(2);
  });

  it("does not retry a session Supabase rejected", async () => {
    const c = client(async () => ({ data: null, error: reused }));
    const r = await readClaims(c);
    expect(r.claims).toBeNull();
    expect(r.error).toBe(reused);
    expect(c.auth.getClaims).toHaveBeenCalledTimes(1);
  });

  it("gives up after two transient failures", async () => {
    const c = client(async () => {
      throw new TypeError("fetch failed");
    });
    const r = await readClaims(c);
    expect(r.claims).toBeNull();
    expect(r.error?.name).toBe("TypeError");
    expect(c.auth.getClaims).toHaveBeenCalledTimes(2);
  });
});
