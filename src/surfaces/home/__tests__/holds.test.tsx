/// <reference types="@testing-library/jest-dom" />
// Home says what the workspace holds, each register a link to its list,
// so it never reads as empty over records (cartograph-engine#109).

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

import { copy } from "@/copy";
import { Holds } from "../Home";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => () => undefined,
}));

const hh = copy.home.holds;

describe("what the workspace holds", () => {
  it("lists each register with records, linked to its list", () => {
    render(
      <Holds
        registers={[
          { kind: "Goal", count: 19 },
          { kind: "Project", count: 1 },
          { kind: "Operation", count: 3 },
          { kind: "Gap", count: 0 },
          { kind: "Team", count: 6 },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: hh.title });
    expect(within(nav).getByRole("link", { name: hh.label(19, "Goals") })).toHaveAttribute("href", "/strategy");
    // One is said in the singular.
    expect(within(nav).getByRole("link", { name: hh.label(1, "Project") })).toHaveAttribute("href", "/projects");
    expect(within(nav).getByRole("link", { name: hh.label(3, "Operations") })).toHaveAttribute("href", "/operations");
    // An empty register, and one with no list of its own, are left out;
    // the rest in the rail's order.
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/strategy", "/projects", "/operations"]);
  });

  it("says nothing for an empty workspace", () => {
    const { container } = render(<Holds registers={[{ kind: "Goal", count: 0 }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
