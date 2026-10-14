/// <reference types="@testing-library/jest-dom" />
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { AmountInput } from "../AmountInput";

let stored: number | undefined;
function Harness({ start }: { start?: number }) {
  const [v, setV] = useState<number | undefined>(start);
  return (
    <AmountInput
      value={v}
      onChange={(next) => {
        stored = next;
        setV(next);
      }}
      currency="USD"
      label="Amount"
    />
  );
}

// An amount is typed in the unit that saves digits, its thousands grouped,
// and the whole of it said beneath (#102).
describe("an amount", () => {
  it("opens in its largest whole unit and says the whole figure", () => {
    render(<Harness start={42000} />);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("42");
    expect(screen.getByText(copy.amount.whole("USD 42,000"))).toBeVisible();
  });
  it("groups thousands as it is typed and stores the plain number", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("textbox", { name: "Amount" }), "1250000");
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("1,250,000");
    expect(stored).toBe(1250000);
  });
});
