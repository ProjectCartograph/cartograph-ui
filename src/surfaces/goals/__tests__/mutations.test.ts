import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as mutations from '../mutations';
import { fakeClient } from '@/client/fake';
import { NotFound, Refused } from '@/client/port';

// The Client is faked at the port: what it returns is what the real one does.
const get = vi.fn();
const saveVersion = vi.fn();
const deleteGoal = vi.fn();
const client = fakeClient({ get, saveVersion, deleteGoal });
const version = { kind: 'Goal', id: 'goal-1', number: 2, actor: 'local', reason: 'r', on: '2026-09-01T00:00:00Z' };

describe('Goal mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('renameGoal', () => {
    it('sends the full manifest with only metadata.name changed', async () => {
      const mockManifest = {
        apiVersion: 'cartograph/v1',
        kind: 'Goal',
        metadata: { id: 'goal-1', name: 'Old Name' },
        spec: {
          level: 'objective',
          parent: 'pillar-1',
          objective: 'Test objective',
          evidence: 'Test evidence',
          keyResults: [{ id: 'kr-1', metric: 'Users', direction: 'up' }],
        },
      };

      get.mockResolvedValueOnce({ manifest: mockManifest, version: { number: 1 }, yaml: '' });

      saveVersion.mockResolvedValueOnce(version);

      const result = await mutations.renameGoal(client, 'goal-1', 'New Name');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      // Verify PUT body: manifest with only name changed, spec fields preserved
      const putCall = saveVersion.mock.calls[0];
      expect(putCall).toBeDefined();
      const sentManifest = putCall[2];
      expect(sentManifest.metadata.name).toBe('New Name');
      expect(sentManifest.spec.objective).toBe('Test objective');
      expect(sentManifest.spec.evidence).toBe('Test evidence');
      expect(sentManifest.spec.keyResults).toEqual([
        { id: 'kr-1', metric: 'Users', direction: 'up' },
      ]);
    });

    it('returns error when manifest not found', async () => {
      get.mockRejectedValueOnce(new NotFound([{ path: '', message: 'not found: Goal/missing' }]));

      const result = await mutations.renameGoal(client, 'missing', 'New Name');

      expect(result.ok).toBe(false);
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.problems[0].message).toContain('not found');
    });
  });

  describe('moveGoal', () => {
    it('sends the full manifest with only spec.parent changed', async () => {
      const mockManifest = {
        apiVersion: 'cartograph/v1',
        kind: 'Goal',
        metadata: { id: 'goal-1', name: 'Strategic Goal' },
        spec: {
          level: 'objective',
          parent: 'pillar-a',
          objective: 'Test objective',
          evidence: 'Test evidence',
          keyResults: [{ id: 'kr-1', metric: 'Users', direction: 'up' }],
        },
      };

      get.mockResolvedValueOnce({ manifest: mockManifest, version: { number: 1 }, yaml: '' });

      saveVersion.mockResolvedValueOnce(version);

      const result = await mutations.moveGoal(client, 'goal-1', 'pillar-b');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      // Verify PUT body: manifest with only parent changed, spec fields preserved
      const putCall = saveVersion.mock.calls[0];
      expect(putCall).toBeDefined();
      const sentManifest = putCall[2];
      expect(sentManifest.spec.parent).toBe('pillar-b');
      expect(sentManifest.spec.objective).toBe('Test objective');
      expect(sentManifest.spec.evidence).toBe('Test evidence');
      expect(sentManifest.spec.keyResults).toEqual([
        { id: 'kr-1', metric: 'Users', direction: 'up' },
      ]);
    });

    it('preserves all fields when moving a goal with key results', async () => {
      const mockManifest = {
        apiVersion: 'cartograph/v1',
        kind: 'Goal',
        metadata: { id: 'goal-1', name: 'Goals' },
        spec: {
          level: 'objective',
          parent: 'pillar-a',
          objective: 'Improve user engagement',
          evidence: 'Based on user interviews',
          whyItMatters: 'Critical for retention',
          keyResults: [
            { id: 'kr-1', metric: 'DAU', direction: 'up', target: 1000 },
            { id: 'kr-2', metric: 'NPS', direction: 'up', baseline: 50, target: 75 },
          ],
        },
      };

      get.mockResolvedValueOnce({ manifest: mockManifest, version: { number: 1 }, yaml: '' });

      saveVersion.mockResolvedValueOnce(version);

      await mutations.moveGoal(client, 'goal-1', 'pillar-c');

      // Verify PUT body preserves all fields
      const sentManifest = saveVersion.mock.calls[0][2];
      expect(sentManifest.spec.parent).toBe('pillar-c');
      expect(sentManifest.spec.objective).toBe('Improve user engagement');
      expect(sentManifest.spec.evidence).toBe('Based on user interviews');
      expect(sentManifest.spec.whyItMatters).toBe('Critical for retention');
      expect(sentManifest.spec.keyResults).toEqual([
        { id: 'kr-1', metric: 'DAU', direction: 'up', target: 1000 },
        { id: 'kr-2', metric: 'NPS', direction: 'up', baseline: 50, target: 75 },
      ]);
    });
  });

  describe('deleteGoal', () => {
    it('sends DELETE with custom reason', async () => {
      deleteGoal.mockResolvedValueOnce(undefined);

      const result = await mutations.deleteGoal(client, 'goal-1', 'leaf goal cleanup');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      expect(deleteGoal).toHaveBeenCalledWith('goal-1', 'leaf goal cleanup');
    });

    it('sends DELETE with default reason when not provided', async () => {
      deleteGoal.mockResolvedValueOnce(undefined);

      const result = await mutations.deleteGoal(client, 'goal-1');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      expect(deleteGoal).toHaveBeenCalledWith('goal-1', 'edited on the tree');
    });

    it('returns error when deletion is refused', async () => {
      deleteGoal.mockRejectedValueOnce(
        new Refused([{ path: '', message: 'Project/p1 (Project One) still references this goal' }]),
      );

      const result = await mutations.deleteGoal(client, 'goal-1', 'test');

      expect(result.ok).toBe(false);
      expect(result.problems).toEqual([
        'Project/p1 (Project One) still references this goal'
      ]);
    });
  });

  describe('saveGoalFields', () => {
    it('keeps the source wording and the links above through a save', async () => {
      saveVersion.mockResolvedValueOnce(version);
      await mutations.saveGoalFields(client, 'c1', 'Outcome', {
        level: 'outcome',
        parent: 'o1',
        objective: 'Faults found at intake',
        statedAs: 'Faults are found at intake.',
        source: 'Plan, section 4',
        contributesTo: [{ goal: 'o2', because: 'Fewer returns' }, { goal: '' }],
      }, 'edit');
      const spec = saveVersion.mock.calls[0][2].spec;
      expect(spec.statedAs).toBe('Faults are found at intake.');
      expect(spec.source).toBe('Plan, section 4');
      // A row with no objective picked is not saved.
      expect(spec.contributesTo).toEqual([{ goal: 'o2', because: 'Fewer returns' }]);
    });
  });
});
