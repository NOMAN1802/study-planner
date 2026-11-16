import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, toFieldErrors } from "@/schemas/auth";

describe("signupSchema", () => {
  it("accepts a valid email and password and trims the email", () => {
    const result = signupSchema.safeParse({
      email: "  person@example.com ",
      password: "longenough",
      timezone: "Asia/Dhaka",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("person@example.com");
      expect(result.data.timezone).toBe("Asia/Dhaka");
    }
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({ email: "nope", password: "longenough" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)).toEqual({ email: "Enter a valid email address" });
    }
  });

  it("rejects a short password", () => {
    const result = signupSchema.safeParse({ email: "a@b.co", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)).toEqual({
        password: "Password must be at least 8 characters",
      });
    }
  });

  it("reports both fields when both are missing", () => {
    const result = signupSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.email).toBe("Email is required");
      expect(errors.password).toBe("Password must be at least 8 characters");
    }
  });

  it("turns an empty timezone into undefined", () => {
    const result = signupSchema.safeParse({
      email: "a@b.co",
      password: "longenough",
      timezone: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBeUndefined();
    }
  });
});

describe("loginSchema", () => {
  it("does not enforce the minimum password length on login", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "x" });
    expect(result.success).toBe(true);
  });

  it("requires a password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)).toEqual({ password: "Password is required" });
    }
  });
});
