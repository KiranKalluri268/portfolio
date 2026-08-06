// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotFound, { metadata as notFoundMetadata } from "../not-found";
import RouteError from "../error";
import GlobalError from "../global-error";
import ErrorBoundary from "@/components/ErrorBoundary";

/**
 * The three pages a visitor only ever sees when something has gone wrong, plus
 * the boundary around the home page's sections. None of them had a test, and
 * they are the hardest surfaces to notice breaking: nothing routes you to them
 * on purpose.
 */

describe("the 404 page", () => {
  it("says what happened in Saikiran's voice, not the framework's", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "There is nothing at this address" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Either I moved this page/)).toBeInTheDocument();
  });

  it("offers a way on rather than a dead end", () => {
    render(<NotFound />);
    const nav = screen.getByRole("navigation");
    expect(nav.querySelectorAll("a")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("asks not to be indexed", () => {
    // A 404 in search results is worse than no result at all.
    expect(notFoundMetadata.robots).toMatchObject({ index: false, follow: true });
  });
});

describe("the route error page", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("puts the failure on the site, not on the visitor", () => {
    render(<RouteError error={new Error("boom")} reset={() => {}} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "That went wrong on my side" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not something you did/)).toBeInTheDocument();
  });

  it("retries the failed segment rather than reloading the site", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<RouteError error={new Error("boom")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("shows the digest, which is the only thing that identifies it in a log", () => {
    const error = Object.assign(new Error("boom"), { digest: "2066959311" });
    render(<RouteError error={error} reset={() => {}} />);
    expect(screen.getByText("Reference 2066959311")).toBeInTheDocument();
  });

  it("shows no reference when there is none to show", () => {
    render(<RouteError error={new Error("boom")} reset={() => {}} />);
    expect(screen.queryByText(/^Reference/)).not.toBeInTheDocument();
  });

  it("records the failure, since nothing else is collecting them yet", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc" });
    render(<RouteError error={error} reset={() => {}} />);
    expect(console.error).toHaveBeenCalledWith("Route error", "abc", error);
  });
});

describe("the global error page", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("assumes nothing from the layout that just failed", () => {
    // It renders its own document and styles itself inline, because the
    // stylesheet the layout imports may never have been applied.
    const markup = render(<GlobalError error={new Error("boom")} reset={() => {}} />);
    const body = markup.container.querySelector("body") ?? document.body;
    expect(body.getAttribute("style") ?? "").toContain("background");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The site failed to load");
  });

  it("offers a reload", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<GlobalError error={new Error("boom")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorBoundary", () => {
  function Boom(): never {
    throw new Error("section failed");
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the rest of the page when one section throws", () => {
    render(
      <div>
        <p>still here</p>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </div>,
    );

    expect(screen.getByText("still here")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("announces the failure rather than swapping content in silently", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("uses a supplied fallback when one is given", () => {
    render(
      <ErrorBoundary fallback={<p>quieter</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("quieter")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders its children untouched when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
