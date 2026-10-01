import { describe, expect, it } from "vitest";

import { syncURL } from "./browser-live";
import { API_BASE } from "./http";

describe("the sync socket", () => {
  it("is ws beside a page served over http, and wss over https", () => {
    const at = (href: string) => new URL(href) as unknown as Location;
    expect(syncURL(API_BASE, at("http://localhost:8080/goals"))).toBe(`ws://localhost:8080${API_BASE}/sync`);
    expect(syncURL(API_BASE, at("https://cartograph.example.org/"))).toBe(`wss://cartograph.example.org${API_BASE}/sync`);
  });
});
