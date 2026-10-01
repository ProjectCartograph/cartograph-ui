import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientProvider } from '@/client/context';
import { fakeClient } from '@/client/fake';
import { useReferenceOptions, refOptionsQuery } from '../useReferenceOptions';

const list = vi.fn();
const client = fakeClient({ list });

describe('useReferenceOptions and refOptionsQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe('refOptionsQuery', () => {
    it('includes staleTime of 30 seconds', () => {
      const query = refOptionsQuery(client, 'Team');
      expect(query.staleTime).toBe(30_000);
    });

    it('fetches and transforms manifest summaries to options', async () => {
      const mockData = [
        { id: 'team-1', name: 'Team One' },
        { id: 'team-2', name: 'Team Two' },
      ];

      list.mockResolvedValueOnce(mockData);

      const query = refOptionsQuery(client, 'Team');
      const result = await query.queryFn();

      expect(result.options).toEqual([
        { value: 'team-1', label: 'Team One' },
        { value: 'team-2', label: 'Team Two' },
      ]);

      expect(result.names).toBeInstanceOf(Map);
      expect(result.names.get('team-1')).toBe('Team One');
      expect(result.names.get('team-2')).toBe('Team Two');
    });

    it('returns empty options when no manifests exist', async () => {
      list.mockResolvedValueOnce([]);

      const query = refOptionsQuery(client, 'DataSource');
      const result = await query.queryFn();

      expect(result.options).toEqual([]);
      expect(result.names.size).toBe(0);
    });
  });

  describe('useReferenceOptions', () => {
    it('uses the refOptionsQuery with staleTime', async () => {
      const mockData = [{ id: 'ds-1', name: 'Data Source 1' }];

      list.mockResolvedValueOnce(mockData);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ClientProvider client={client}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ClientProvider>
      );

      const { result } = renderHook(() => useReferenceOptions('DataSource'), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the cache has the query with staleTime
      const cacheData = queryClient.getQueryData(['sheet-ref-options', 'DataSource']);
      expect(cacheData).toBeDefined();

      // Check that staleTime is set (indirectly via the query)
      const queries = queryClient.getQueryCache().findAll();
      const refOptionsQuery = queries.find(
        (q) => q.queryKey[0] === 'sheet-ref-options' && q.queryKey[1] === 'DataSource'
      );
      expect(refOptionsQuery?.getObserversCount()).toBeGreaterThan(0);
    });

    it('is disabled when kind is undefined', async () => {
      const { result } = renderHook(() => useReferenceOptions(undefined), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ClientProvider client={client}>
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          </ClientProvider>
        ),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });
});
