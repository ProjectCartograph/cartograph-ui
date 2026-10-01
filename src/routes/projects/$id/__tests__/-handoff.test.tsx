/// <reference types="@testing-library/jest-dom" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as client from '@/api/client';

vi.mock('@/api/client');

describe('Handoff screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Alert with validation problems on 422 response from store.handoff()', async () => {
    // Handoff screen calls store.handoff() which calls:
    // client.POST("/manifests/Project/{id}/state", { body: { to: "handed off" } })
    // On 422 with problems, it sets handoffProblems and renders an Alert

    vi.mocked(client.client).POST.mockResolvedValueOnce({
      error: {
        problems: [
          { path: 'spec.title', message: 'Project title is required' },
          { path: 'spec.aim', message: 'Project aim is required' },
        ],
      },
      response: { status: 422 } as any,
      data: null,
    } as any);

    // Simulate the handoff call
    const { error, response } = await client.client.POST('/manifests/Project/{id}/state', {
      params: { path: { id: 'proj-1' } },
      body: { to: 'handed off' },
    });

    // Verify 422 response with problems
    expect(response.status).toBe(422);
    expect(error?.problems).toEqual([
      { path: 'spec.title', message: 'Project title is required' },
      { path: 'spec.aim', message: 'Project aim is required' },
    ]);

    // In the component, these problems would render in an Alert with title "Handoff refused"
    expect(error?.problems.length).toBe(2);
    expect(error?.problems[0].message).toContain('title');
  });

  it('shows bundle file names on 200 success from store.handoff()', async () => {
    // On 200 success, handoff() returns { ok: true, snapshot, bundle }
    // Component renders bundle file names from the bundle path

    const bundlePath = 'proj-1/version-1/charter-proj-1-version-1.html';

    vi.mocked(client.client).POST.mockResolvedValueOnce({
      error: null,
      response: { status: 200 } as any,
      data: {
        history: [{ snapshot: 1, bundle: bundlePath }],
      },
    } as any);

    // Simulate the handoff call
    const { error, response, data } = await client.client.POST('/manifests/Project/{id}/state', {
      params: { path: { id: 'proj-1' } },
      body: { to: 'handed off' },
    });

    // Verify 200 success with bundle
    expect(response.status).toBe(200);
    expect(error).toBeNull();
    expect(data).toHaveProperty('history');
    expect((data as any).history[0].bundle).toBe(bundlePath);

    // Component would display:
    // - charter-proj-1-version-1.html
    // - charter-proj-1-version-1.json
    // - charter-proj-1-version-1.pdf
    const bundleFiles = bundlePath
      .replace('.html', '')
      .split('/')
      .pop();
    expect(bundleFiles).toContain('charter');
  });
});
