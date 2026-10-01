import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as mutations from '../mutations';
import * as client from '@/api/client';

// Mock the client module at the boundary
vi.mock('@/api/client');

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

      // Mock GET to return the current manifest
      // Like the real client: the body is already parsed into data, and a
      // second response.json() throws "body used".
      vi.mocked(client.client).GET.mockResolvedValueOnce({
        data: { manifest: mockManifest, version: { number: 1 }, yaml: '' },
        response: { status: 200, json: () => Promise.reject(new Error('body used')) },
      } as any);

      // Mock PUT to succeed
      vi.mocked(client.client).PUT.mockResolvedValueOnce({
        error: null,
        response: { status: 200 } as any,
        data: null,
      } as any);

      const result = await mutations.renameGoal('goal-1', 'New Name');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      // Verify PUT body: manifest with only name changed, spec fields preserved
      const putCall = vi.mocked(client.client).PUT.mock.calls[0];
      expect(putCall).toBeDefined();
      const sentManifest = (putCall[1].body as any).manifest;
      expect(sentManifest.metadata.name).toBe('New Name');
      expect(sentManifest.spec.objective).toBe('Test objective');
      expect(sentManifest.spec.evidence).toBe('Test evidence');
      expect(sentManifest.spec.keyResults).toEqual([
        { id: 'kr-1', metric: 'Users', direction: 'up' },
      ]);
    });

    it('returns error when manifest not found', async () => {
      vi.mocked(client.client).GET.mockResolvedValueOnce({
        data: undefined,
        error: { problems: [{ path: '', message: 'not found: Goal/missing' }] },
        response: { status: 404, json: () => Promise.reject(new Error('body used')) },
      } as any);

      const result = await mutations.renameGoal('missing', 'New Name');

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

      // Like the real client: the body is already parsed into data, and a
      // second response.json() throws "body used".
      vi.mocked(client.client).GET.mockResolvedValueOnce({
        data: { manifest: mockManifest, version: { number: 1 }, yaml: '' },
        response: { status: 200, json: () => Promise.reject(new Error('body used')) },
      } as any);

      vi.mocked(client.client).PUT.mockResolvedValueOnce({
        error: null,
        response: { status: 200 } as any,
        data: null,
      } as any);

      const result = await mutations.moveGoal('goal-1', 'pillar-b');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      // Verify PUT body: manifest with only parent changed, spec fields preserved
      const putCall = vi.mocked(client.client).PUT.mock.calls[0];
      expect(putCall).toBeDefined();
      const sentManifest = (putCall[1].body as any).manifest;
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

      // Like the real client: the body is already parsed into data, and a
      // second response.json() throws "body used".
      vi.mocked(client.client).GET.mockResolvedValueOnce({
        data: { manifest: mockManifest, version: { number: 1 }, yaml: '' },
        response: { status: 200, json: () => Promise.reject(new Error('body used')) },
      } as any);

      vi.mocked(client.client).PUT.mockResolvedValueOnce({
        error: null,
        response: { status: 200 } as any,
        data: null,
      } as any);

      await mutations.moveGoal('goal-1', 'pillar-c');

      // Verify PUT body preserves all fields
      const putCall = vi.mocked(client.client).PUT.mock.calls[0];
      const sentManifest = (putCall[1].body as any).manifest;
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
      vi.mocked(client.client).DELETE.mockResolvedValueOnce({
        error: null,
        response: { status: 204 } as any,
        data: null,
      } as any);

      const result = await mutations.deleteGoal('goal-1', 'leaf goal cleanup');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      const deleteCall = vi.mocked(client.client).DELETE.mock.calls[0];
      expect(deleteCall).toBeDefined();
      expect((deleteCall[1].body as any).reason).toBe('leaf goal cleanup');
    });

    it('sends DELETE with default reason when not provided', async () => {
      vi.mocked(client.client).DELETE.mockResolvedValueOnce({
        error: null,
        response: { status: 204 } as any,
        data: null,
      } as any);

      const result = await mutations.deleteGoal('goal-1');

      expect(result.ok).toBe(true);
      expect(result.problems).toEqual([]);

      const deleteCall = vi.mocked(client.client).DELETE.mock.calls[0];
      expect((deleteCall[1].body as any).reason).toBe('edited on the tree');
    });

    it('returns error when deletion is refused', async () => {
      vi.mocked(client.client).DELETE.mockResolvedValueOnce({
        error: { problems: [{ message: 'Project/p1 (Project One) still references this goal' }] },
        response: { status: 422 } as any,
        data: null,
      } as any);

      const result = await mutations.deleteGoal('goal-1', 'test');

      expect(result.ok).toBe(false);
      expect(result.problems).toEqual([
        'Project/p1 (Project One) still references this goal'
      ]);
    });
  });

  describe('saveGoalFields', () => {
    it('keeps the source wording and the links above through a save', async () => {
      vi.mocked(client.client).PUT.mockResolvedValueOnce({ error: null, response: { status: 200 } as any, data: null } as any);
      await mutations.saveGoalFields('c1', 'Outcome', {
        level: 'outcome',
        parent: 'o1',
        objective: 'Faults found at intake',
        statedAs: 'Faults are found at intake.',
        source: 'Plan, section 4',
        contributesTo: [{ goal: 'o2', because: 'Fewer returns' }, { goal: '' }],
      }, 'edit');
      const spec = (vi.mocked(client.client).PUT.mock.calls[0][1].body as any).manifest.spec;
      expect(spec.statedAs).toBe('Faults are found at intake.');
      expect(spec.source).toBe('Plan, section 4');
      // A row with no objective picked is not saved.
      expect(spec.contributesTo).toEqual([{ goal: 'o2', because: 'Fewer returns' }]);
    });
  });
});
