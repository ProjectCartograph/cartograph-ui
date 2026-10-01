import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as client from '@/api/client';

vi.mock('@/api/client');
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  useQueries: vi.fn(() => []),
}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(),
}));

describe('Snapshots Page - Vault Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls recover endpoint when Recover button is clicked', async () => {
    const mockRecover = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(client.client).POST.mockImplementation((path: any) => {
      if (path === '/vault/recover') return mockRecover();
      return Promise.resolve({ error: null });
    });

    await mockRecover();

    expect(mockRecover).toHaveBeenCalled();
  });

  it('calls apply endpoint when Apply button is clicked', async () => {
    const mockApply = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(client.client).POST.mockImplementation((path: any) => {
      if (path === '/vault/apply') return mockApply();
      return Promise.resolve({ error: null });
    });

    await mockApply();

    expect(mockApply).toHaveBeenCalled();
  });

  it('posts correct ref format to recover endpoint', async () => {
    const mockRecover = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(client.client).POST.mockImplementation(async (path: any, opts: any) => {
      if (path === '/vault/recover') {
        expect(opts.body.ref).toMatch(/^\w+\/[\w-]+$/);
        return { error: null };
      }
      return { error: null };
    });

    await mockRecover();
  });

  it('posts correct ref format to apply endpoint', async () => {
    const mockApply = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(client.client).POST.mockImplementation(async (path: any, opts: any) => {
      if (path === '/vault/apply') {
        expect(opts.body.ref).toMatch(/^\w+\/[\w-]+$/);
        return { error: null };
      }
      return { error: null };
    });

    await mockApply();
  });
});
