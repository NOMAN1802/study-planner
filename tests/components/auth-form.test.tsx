import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";
import type { AuthState } from "@/schemas/auth";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;
const mockAction = (impl: () => Promise<AuthState>) => vi.fn<Action>(impl);

vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("AuthForm", () => {
  it("renders the sign-in fields and a link to sign up", () => {
    const action = mockAction(async () => ({}));
    render(<AuthForm mode="login" action={action} />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("shows validation errors and does not call the action for invalid input", async () => {
    const user = userEvent.setup();
    const action = mockAction(async () => ({}));
    render(<AuthForm mode="signup" action={action} />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(action).not.toHaveBeenCalled();
  });

  it("calls the action with the form data for valid input", async () => {
    const user = userEvent.setup();
    const action = mockAction(async () => ({}));
    render(<AuthForm mode="signup" action={action} />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "longenough");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get("email")).toBe("person@example.com");
    expect(formData.get("password")).toBe("longenough");
  });

  it("renders a server error returned by the action", async () => {
    const user = userEvent.setup();
    const action = mockAction(async () => ({ error: "Incorrect email or password." }));
    render(<AuthForm mode="login" action={action} />);

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });
});
