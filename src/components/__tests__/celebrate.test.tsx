/// <reference types="@testing-library/jest-dom" />
// Confetti for what commits something, from the button pressed for it.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { fakeClient } from "@/client/fake";

const burst = vi.fn();
vi.mock("../confetti", async (actual) => ({ ...(await actual<typeof import("../confetti")>()), confetti: (o: unknown) => burst(o) }));

const { celebrating } = await import("../celebrate");
const { advance } = await import("../confetti");

beforeEach(() => burst.mockClear());

describe("celebrating", () => {
  it("bursts from the button pressed when a version is saved", async () => {
    const client = celebrating(fakeClient({ saveVersion: async () => ({ number: 2 }) as never }));
    render(<button type="button">Save as version</button>);
    const button = screen.getByRole("button");
    button.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 30 }) as DOMRect;
    fireEvent.pointerDown(button);
    await client.saveVersion("Goal", "g1", {}, "r");
    expect(burst).toHaveBeenCalledWith({ left: 10, top: 20, width: 100, height: 30 });
  });

  it("never for a draft, nor for a save nobody pressed for", async () => {
    const client = celebrating(fakeClient({ saveWorking: async () => undefined, saveVersion: async () => ({ number: 2 }) as never }));
    render(<button type="button">Save</button>);
    fireEvent.pointerDown(screen.getByRole("button"));
    await client.saveWorking("Goal", "g1", "text");
    expect(burst).not.toHaveBeenCalled();
    await client.saveVersion("Goal", "g1", {}, "r");
    await client.saveVersion("Goal", "g1", {}, "r");
    expect(burst).toHaveBeenCalledTimes(1);
  });

  it("not when it fails", async () => {
    const client = celebrating(fakeClient({ acceptProposal: async () => Promise.reject(new Error("refused")) }));
    render(<button type="button">Accept</button>);
    fireEvent.pointerDown(screen.getByRole("button"));
    await expect(client.acceptProposal("p1")).rejects.toThrow("refused");
    expect(burst).not.toHaveBeenCalled();
  });
});

describe("confetti", () => {
  it("moves by time, not by frames, and ends", () => {
    const at60 = [{ x: 0, y: 0, vx: 100, vy: -500, angle: 0, spin: 1, tilt: 0, flip: 1, wobble: 0, sway: 0, w: 6, h: 3, color: "#000", round: false, life: 1, lived: 0 }];
    const at144 = at60.map((p) => ({ ...p }));
    for (let i = 0; i < 30; i++) advance(at60, 1 / 60, 1000);
    for (let i = 0; i < 72; i++) advance(at144, 1 / 144, 1000);
    expect(Math.abs(at60[0].y - at144[0].y)).toBeLessThan(6);
    expect(advance(at60, 0.6, 1000)).toBe(false);
  });
});
