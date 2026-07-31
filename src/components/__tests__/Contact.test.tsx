// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ContactSection from "../Contact";

describe("ContactSection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows validation errors and does not submit when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<ContactSection />);

    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Message is required")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("flags a malformed email address without submitting", async () => {
    const user = userEvent.setup();
    render(<ContactSection />);

    await user.type(screen.getByLabelText(/name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/message/i), "Hello there");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits valid data, posts JSON to /api/contact, and shows a success state", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    const user = userEvent.setup();
    render(<ContactSection />);

    await user.type(screen.getByLabelText(/name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/message/i), "Hello there");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/contact");
    expect(JSON.parse(init!.body as string)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello there",
    });

    expect(await screen.findByRole("status")).toHaveTextContent(/thanks for reaching out/i);
  });

  it("shows a submission error message when the API call fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Please check your form details." }),
    } as Response);

    const user = userEvent.setup();
    render(<ContactSection />);

    await user.type(screen.getByLabelText(/name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/message/i), "Hello there");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please check your form details.");
  });
});
