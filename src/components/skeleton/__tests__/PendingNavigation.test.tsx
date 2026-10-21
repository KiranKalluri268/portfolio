// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors are the point: PendingNavigation reads any link. */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PendingNavigation, { announceNavigation } from "../PendingNavigation";
import { skeletonFor } from "../RouteSkeleton";

let pathname = "/faq";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function setup() {
  window.history.replaceState(null, "", pathname);
  return render(
    <>
      <a href="/projects/certisafe" onClick={(event) => event.preventDefault()}>A project</a>
      <a href="/projects/certisafe" target="_blank">In a new tab</a>
      <a href="https://example.com/x">Elsewhere</a>
      <a href="/#contact">Contact on the home page</a>
      <PendingNavigation />
    </>,
  );
}

describe("skeletonFor", () => {
  it("has a shape for each content page, and none for the home page", () => {
    for (const path of ["/projects", "/projects/certisafe", "/skills", "/skills/react", "/experience/aude-ai", "/resume", "/resume/ai", "/cv", "/faq"]) {
      expect(skeletonFor(path), path).not.toBeNull();
    }
    expect(skeletonFor("/")).toBeNull();
    expect(skeletonFor("/admin")).toBeNull();
  });
});

describe("PendingNavigation", () => {
  afterEach(() => {
    pathname = "/faq";
    delete document.documentElement.dataset.navigating;
  });

  it("puts the destination's skeleton up the moment a link is clicked, even one whose handler navigates itself", () => {
    setup();
    fireEvent.click(screen.getByText("A project"));
    expect(screen.getByRole("status")).toHaveTextContent("Loading the project");
    expect(document.documentElement.dataset.navigating).toBe("true");
  });

  it("takes it down once the address has changed", () => {
    const { rerender } = setup();
    fireEvent.click(screen.getByText("A project"));
    pathname = "/projects/certisafe";
    rerender(
      <>
        <PendingNavigation />
      </>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.documentElement.dataset.navigating).toBeUndefined();
  });

  it("leaves new tabs, other sites, modified clicks and pages without a skeleton alone", () => {
    setup();
    fireEvent.click(screen.getByText("In a new tab"));
    fireEvent.click(screen.getByText("Elsewhere"));
    fireEvent.click(screen.getByText("Contact on the home page"));
    fireEvent.click(screen.getByText("A project"), { ctrlKey: true });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("answers a drawn card's announcement", () => {
    setup();
    act(() => announceNavigation("/projects/third-eye-ai"));
    expect(screen.getByRole("status")).toHaveTextContent("Loading the project");
  });
});
