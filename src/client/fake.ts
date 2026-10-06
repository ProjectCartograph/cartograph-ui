import type { Client } from "./port";

// Every method, so a method added to the port and not here fails the
// type check rather than a test.
const every: Record<keyof Client, true> = {
  kinds: true,
  schema: true,
  settings: true,
  list: true,
  get: true,
  versions: true,
  references: true,
  saveWorking: true,
  discardWorking: true,
  saveVersion: true,
  snapshot: true,
  checks: true,
  goalTree: true,
  graph: true,
  order: true,
  glossary: true,
  understand: true,
  relevant: true,
  decisionModel: true,
  fromIdea: true,
  match: true,
  gapCoverage: true,
  cyclePeriods: true,
  deleteGoal: true,
  projectState: true,
  transition: true,
  vault: true,
  unapplied: true,
  excluded: true,
  apply: true,
  recover: true,
  snapshots: true,
  charter: true,
  charterLink: true,
  session: true,
  sharedDocument: true,
  presenceDocument: true,
  openDraft: true,
  joinPresence: true,
  followAgents: true,
  watchConnection: true,
  people: true,
  grantPerson: true,
  removePerson: true,
  proposals: true,
  getProposal: true,
  changeSets: true,
  changeSet: true,
  includeChangeSetItem: true,
  acceptChangeSet: true,
  reopenChangeSet: true,
  closeChangeSet: true,
  startChangeSet: true,
  retitleChangeSet: true,
  proposeChangeSet: true,
  dropChangeSetItem: true,
  getGuide: true,
  acceptProposal: true,
  declineProposal: true,
  agentGrants: true,
  mcpAddress: true,
  createAgentToken: true,
  revokeAgentGrant: true,
};

/**
 * A Client for a test: the methods given, and every other one rejecting
 * with its own name, so a test that reaches for something it did not
 * fake says which. What a fake returns is what the real client returns.
 */
export function fakeClient(given: Partial<Client> = {}): Client {
  const client: Record<string, unknown> = {};
  for (const name of Object.keys(every) as (keyof Client)[]) {
    client[name] =
      given[name] ??
      (name === "charterLink"
        ? () => ""
        : name === "watchConnection"
          ? // A test that does not ask about the connection is online and
            // stays so.
            (listener: (s: string) => void) => {
              listener("online");
              return () => {};
            }
          : () => Promise.reject(new Error(`fake client: ${name} not faked`)));
  }
  return client as unknown as Client;
}
