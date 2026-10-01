import { describe, it, expect } from "vitest";

import { httpClient } from "./http";
import { ClientError, Conflict, NotFound, Refused } from "./port";

/** A fetch that records what it was asked and answers with one status and
 * one body, the way the engine would. */
function wire(status: number, body?: unknown, type = "application/json") {
  const asked: { method: string; url: string; body?: unknown }[] = [];
  const fetch = async (req: Request) => {
    const text = await req.text();
    asked.push({ method: req.method, url: req.url, body: text ? JSON.parse(text) : undefined });
    const payload = body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body);
    return new Response(status === 204 ? null : payload, { status, headers: { "Content-Type": type } });
  };
  return { client: httpClient({ baseUrl: "http://engine/api/v1", fetch }), asked };
}

describe("the HTTP adapter", () => {
  it("lists a kind as rows, whether the engine answers with an array or a page", async () => {
    const rows = [{ kind: "Goal", id: "g1", name: "One", version: 1, updatedOn: "2026-09-01T00:00:00Z" }];
    expect(await wire(200, rows).client.list("Goal")).toEqual(rows);
    expect(await wire(200, { items: rows, next: null }).client.list("Goal")).toEqual(rows);
  });

  it("sends a listing's filters as the query", async () => {
    const { client, asked } = wire(200, []);
    await client.list("Gap", { q: "late", ref: ["Goal/g1", "Goal/g2"], expand: "spec" });
    const url = new URL(asked[0].url);
    expect(url.pathname).toBe("/api/v1/manifests/Gap");
    expect(url.searchParams.get("q")).toBe("late");
    expect(url.searchParams.getAll("ref")).toEqual(["Goal/g1", "Goal/g2"]);
    expect(url.searchParams.get("expand")).toBe("spec");
  });

  it("writes the working copy as text, and never the validating write", async () => {
    const { client, asked } = wire(204);
    await client.saveWorking("Project", "p1", "kind: Project\n");
    expect(asked).toEqual([
      { method: "PUT", url: "http://engine/api/v1/manifests/Project/p1/working", body: { yaml: "kind: Project\n" } },
    ]);
  });

  it("saves a version from text as yaml, and from an object as a manifest", async () => {
    const version = { kind: "Goal", id: "g1", number: 2, actor: "local", reason: "r", on: "2026-09-01T00:00:00Z" };
    const text = wire(200, version);
    expect(await text.client.saveVersion("Goal", "g1", "kind: Goal\n", "r")).toEqual(version);
    expect(text.asked[0].body).toEqual({ yaml: "kind: Goal\n", reason: "r" });
    const object = wire(200, version);
    await object.client.saveVersion("Goal", "g1", { kind: "Goal" }, "r");
    expect(object.asked[0].body).toEqual({ manifest: { kind: "Goal" }, reason: "r" });
  });

  it("throws Refused with the server's problems when a write is refused", async () => {
    const problems = [{ path: "/spec/aim", message: "An aim is needed." }];
    const err = await wire(422, { problems }).client.transition("p1", "handed off").catch((e) => e);
    expect(err).toBeInstanceOf(Refused);
    expect(err.problems).toEqual(problems);
  });

  it("tells a conflict and a missing manifest from a refusal", async () => {
    const conflict = await wire(409, { ours: "", theirs: "" }).client.saveVersion("Goal", "g1", "", "r").catch((e) => e);
    expect(conflict).toBeInstanceOf(Conflict);
    expect(conflict.problems).toEqual([]);
    const missing = await wire(404, { problems: [] }).client.get("Goal", "nope").catch((e) => e);
    expect(missing).toBeInstanceOf(NotFound);
    const other = await wire(500, "boom", "text/plain").client.vault().catch((e) => e);
    expect(other).toBeInstanceOf(ClientError);
    expect(other.status).toBe(500);
  });

  it("applies every reference in one request, and recovers one", async () => {
    const vault = { apiVersion: "cartograph/v1", kind: "Vault", metadata: { id: "v" }, spec: {} };
    const apply = wire(200, vault);
    await apply.client.apply(["Gap/g1", "Gap/g2"]);
    expect(apply.asked).toEqual([
      { method: "POST", url: "http://engine/api/v1/vault/apply", body: { refs: ["Gap/g1", "Gap/g2"] } },
    ]);
    const recover = wire(200, vault);
    await recover.client.recover("Gap/g1");
    expect(recover.asked).toEqual([
      { method: "POST", url: "http://engine/api/v1/vault/recover", body: { ref: "Gap/g1" } },
    ]);
  });

  it("asks each kind for its own checks", async () => {
    const { client, asked } = wire(200, []);
    await client.checks("Programme", "pr1");
    await client.checks("Goal", "g1");
    expect(asked.map((a) => new URL(a.url).pathname)).toEqual([
      "/api/v1/manifests/Programme/pr1/checks",
      "/api/v1/manifests/Goal/g1/checks",
    ]);
  });

  it("reads a charter as HTML, and links to it where a browser can open it", async () => {
    const { client, asked } = wire(200, "<h1>Charter</h1>", "text/html");
    expect(await client.charter("Project", "p1", { working: true })).toBe("<h1>Charter</h1>");
    expect(asked[0].url).toBe("http://engine/api/v1/manifests/Project/p1/charter.html?working=true");
    expect(client.charterLink("Programme", "pr1", "pdf")).toBe("http://engine/api/v1/manifests/Programme/pr1/charter.pdf");
    expect(httpClient().charterLink("Project", "p1", "html", { working: true })).toBe(
      "/api/v1/manifests/Project/p1/charter.html?working=true",
    );
  });
});
