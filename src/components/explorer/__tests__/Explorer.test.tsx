import { copy } from "@/copy";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { Package } from "lucide-react";
import { Explorer, type ExplorerRow } from "../Explorer";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: ReactNode }) => <a href="#" {...rest}>{children}</a>,
  useNavigate: () => navigate,
}));

const row = (id: string, name: string, folder: string[], labels?: Record<string, string>): ExplorerRow => ({
  id, name, folder, labels, marks: null, preview: <p>{`preview of ${name}`}</p>,
});

const rows: ExplorerRow[] = [
  { ...row("a", "Quality check rollout", ["Raise quality"], { pack: "board" }), children: [row("a1", "Scanner purchase", ["Raise quality"])] },
  row("b", "Cold store upgrade", ["Cut loss"]),
  row("c", "Member register", []),
];

function renderIt() {
  render(<Explorer title="Projects" icon={Package} rows={rows} route="/projects/$id" />);
}

describe("Explorer", () => {
  it("files rows in folders, nests components, and previews the first row", () => {
    renderIt();
    expect(screen.getByRole("treeitem", { name: /Raise quality/ })).toBeTruthy();
    expect(screen.getByText("Scanner purchase")).toBeTruthy();
    // Four records in all, components counted.
    expect(screen.getByRole("heading", { name: /Projects\s*4/ })).toBeTruthy();
    expect(screen.getByText(/preview of/)).toBeTruthy();
  });

  it("filters fuzzily on the name, and on a label", () => {
    renderIt();
    const filter = screen.getByLabelText(copy.explorer.filter);
    fireEvent.change(filter, { target: { value: "cldstr" } });
    let tree = within(screen.getByRole("tree"));
    expect(tree.getByText("Cold store upgrade")).toBeTruthy();
    expect(tree.queryByText("Member register")).toBeNull();
    fireEvent.change(filter, { target: { value: "board" } });
    tree = within(screen.getByRole("tree"));
    expect(tree.getByText("Quality check rollout")).toBeTruthy();
    expect(tree.queryByText("Cold store upgrade")).toBeNull();
  });

  it("selects with a click, previews it, and opens with Enter", () => {
    renderIt();
    fireEvent.click(within(screen.getByRole("tree")).getByText("Member register"));
    expect(screen.getByText("preview of Member register")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tree"), { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/$id", params: { id: "c" } });
  });

  it("closes a folder", () => {
    renderIt();
    fireEvent.click(screen.getByRole("treeitem", { name: /Cut loss/ }));
    expect(within(screen.getByRole("tree")).queryByText("Cold store upgrade")).toBeNull();
  });
});
