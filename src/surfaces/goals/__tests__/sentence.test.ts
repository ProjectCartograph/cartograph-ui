import { describe, it, expect } from "vitest";

import { joinMetric, splitMetric } from "../sentence";

// One builder writes the key result sentence, and both the dialog preview
// and the saved card read from it (Programme Lead, 2026-09-26: the short
// version did not read correctly; each should carry the full key result).
describe("the metric is a unit and an outcome", () => {
  it("joins them into the one string the contract stores", () => {
    expect(joinMetric("deliveries", "checked")).toBe("deliveries checked");
    expect(joinMetric("USD", "recovered from duplicate payments")).toBe("USD recovered from duplicate payments");
  });

  it("keeps whichever half it has when the other is empty", () => {
    expect(joinMetric("", "tickets resolved first time")).toBe("tickets resolved first time");
    expect(joinMetric("deliveries", "")).toBe("deliveries");
  });

  it("splits a stored metric back into the half an editor asks for", () => {
    expect(splitMetric("deliveries checked", "deliveries")).toBe("checked");
    expect(splitMetric("Deliveries checked", "deliveries")).toBe("checked");
  });

  it("leaves a metric written elsewhere whole rather than rewriting it", () => {
    // A metric that does not start with its unit was written by hand or in
    // YAML; the editor shows it as it is instead of trapping it.
    expect(splitMetric("orders checked at intake", "deliveries")).toBe("orders checked at intake");
    expect(splitMetric("tickets resolved", "")).toBe("tickets resolved");
  });

  it("round-trips", () => {
    const stored = "deliveries checked";
    expect(joinMetric("deliveries", splitMetric(stored, "deliveries"))).toBe(stored);
  });
});
