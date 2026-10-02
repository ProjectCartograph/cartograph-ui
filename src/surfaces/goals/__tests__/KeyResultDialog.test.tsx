/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { KeyResultDialog } from "../KeyResultDialog";

const c = copy.goals.keyResultDialog;

function renderDialog(props: Partial<React.ComponentProps<typeof KeyResultDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSave = vi.fn();
  render(
    <ClientProvider client={fakeClient()}>
      <QueryClientProvider client={client}>
        <KeyResultDialog open onOpenChange={vi.fn()} onSave={onSave} allowSource={false} {...props} />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return { onSave };
}

describe("KeyResultDialog", () => {
  // No sentence is assembled from the parts. The preview that did it read
  // as a promise that the tool would write a good sentence, which it
  // cannot (LSS_REVIEW.md, D19); the parts themselves are the answer.
  it("shows the parts, not a sentence built from them", () => {
    renderDialog();
    expect(document.querySelector('[data-slot="kr-sentence"]')).toBeNull();
  });

  it("never asks for the unit twice: the field carries it as a prefix", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.type(screen.getByLabelText(c.unitLabel), "deliveries");
    // The unit is shown beside the field, not typed into it.
    const field = screen.getByLabelText(c.stepMetric);
    expect(field.closest('[data-slot="input-group"]')).toHaveTextContent("deliveries");

    await user.type(field, "checked");
    await user.click(screen.getByRole("radio", { name: "Increase" }));
    await user.click(screen.getByRole("button", { name: "Save key result" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ metric: "deliveries checked", direction: "increase" });
  });

  it("asks for the whole phrase where the kind has no unit", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.click(screen.getByRole("radio", { name: "Percent" }));
    expect(screen.queryByLabelText(c.unitLabel)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(c.stepMetricWhole), "tickets resolved first time");
    await user.click(screen.getByRole("button", { name: "Save key result" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ metric: "tickets resolved first time", kind: "percent" });
  });

  it("changes every example to match the kind of number chosen", async () => {
    const user = userEvent.setup();
    renderDialog();

    // Count is the default: a finite thing, with the word for one of them.
    // The metric field asks only for the outcome half.
    expect(screen.getByPlaceholderText("published")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("process maps")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Percent" }));

    expect(screen.getByPlaceholderText("support tickets resolved on first contact")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("95")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("62")).toBeInTheDocument();
    // A percent needs no unit, so the unit field is gone.
    expect(screen.queryByLabelText("Unit")).not.toBeInTheDocument();
  });

  it("refuses to save a count with no word for one of them, and marks the unit", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    const unit = screen.getByLabelText(c.unitLabel);
    const metric = screen.getByLabelText(c.stepMetric);
    await user.type(metric, "published");
    const save = screen.getByRole("button", { name: "Save key result" });
    // Live, not disabled: the Programme Lead met this as "a key result
    // cannot be applied", because a dead button explains nothing. A
    // refused save marks the part it is waiting on instead.
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
    expect(unit).toHaveAttribute("aria-invalid", "true");
    expect(metric).toHaveAttribute("aria-invalid", "false");

    await user.type(unit, "process maps");
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    // The unit and the outcome are stored as one metric.
    expect(onSave.mock.calls[0][0]).toMatchObject({
      metric: "process maps published",
      direction: "reach",
      kind: "count",
      unit: "process maps",
    });
  });

  it("refuses an empty form and marks the metric, not everything", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Save key result" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText(c.stepMetric)).toHaveAttribute("aria-invalid", "true");
  });

  it("refuses an unknown baseline with no reason given", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();
    await user.click(screen.getByRole("radio", { name: "Percent" }));
    await user.type(screen.getByLabelText(c.stepMetricWhole), "tickets resolved first time");
    await user.click(screen.getByRole("radio", { name: "Not known yet" }));
    await user.click(screen.getByRole("button", { name: "Save key result" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText(c.unknownReasonLabel)).toHaveAttribute("aria-invalid", "true");
  });

  it("saves a project key result with its data source step on", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog({ allowSource: true });

    await user.type(screen.getByLabelText(c.unitLabel), "deliveries");
    await user.type(screen.getByLabelText(c.stepMetric), "checked");
    await user.click(screen.getByRole("button", { name: "Save key result" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      metric: "deliveries checked",
      unit: "deliveries",
      kind: "count",
    });
  });

  it("refuses a target figure with no month, rather than dropping it", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog({ allowSource: true });
    await user.type(screen.getByLabelText(c.unitLabel), "deliveries");
    await user.type(screen.getByLabelText(c.stepMetric), "checked");
    await user.type(screen.getByLabelText(c.targetValueLabel), "1200");
    await user.click(screen.getByRole("button", { name: "Save key result" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(c.halfFilled)).toBeInTheDocument();
  });

  it("hides the data source step for a goal's own key result", () => {
    renderDialog();
    expect(screen.queryByText("Measured from")).not.toBeInTheDocument();
  });
});
