/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FieldHeading } from "@/components/guidance";
import { ExamplesContext, useExamples } from "@/components/examples";

// TAXONOMY.md D20: the product ships generic examples; a vault may supply
// its own per field. Without a vault behind the screen, the product's own
// are shown.
describe("vault examples", () => {
  it("falls back to the product's examples when no vault supplies any", () => {
    function Probe() {
      return <output>{useExamples("problem.situation", ["Generic example."])?.join("|")}</output>;
    }
    render(<Probe />);
    expect(screen.getByRole("status")).toHaveTextContent("Generic example.");
  });

  it("still offers the product's examples behind the lightbulb", async () => {
    const user = userEvent.setup();
    render(<FieldHeading label="What's wrong" examples={["Generic example."]} exampleKey="problem.situation" />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Generic example.")).toBeInTheDocument();
  });

  it("shows the vault's own examples for a field it supplies", () => {
    function Probe({ k }: { k: string }) {
      return <output data-testid={k}>{useExamples(k, ["Generic example."])?.join("|")}</output>;
    }
    render(
      <ExamplesContext.Provider value={{ "problem.situation": ["Its own example."] }}>
        <Probe k="problem.situation" />
        <Probe k="problem.cause" />
      </ExamplesContext.Provider>,
    );
    expect(screen.getByTestId("problem.situation")).toHaveTextContent("Its own example.");
    expect(screen.getByTestId("problem.cause")).toHaveTextContent("Generic example.");
  });
});
