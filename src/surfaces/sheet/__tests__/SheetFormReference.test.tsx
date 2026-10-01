import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientProvider } from '@/client/context';
import { fakeClient } from '@/client/fake';
import { SheetForm } from '../SheetForm';
import type { FieldDef } from '../schema';

const list = vi.fn();

// DataSource.spec.team: the one required reference in any sheet dialog. A
// combobox only selects what exists, so a dialog that cannot also create a
// team leaves this field, and the whole data source, impossible to finish.
const TEAM_FIELD: FieldDef = { name: 'team', kind: 'ref', refKind: 'Team', required: true };

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ClientProvider client={fakeClient({ list })}>
      <QueryClientProvider client={queryClient}>
        <SheetForm
          kind="DataSource"
          kindLabel="Data source"
          fields={[TEAM_FIELD]}
          open
          onOpenChange={() => {}}
        />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe('a reference field inside the Add sheet dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers to add the referenced entry when the directory has some', async () => {
    list.mockResolvedValue([{ id: 'team-1', name: 'Team One' }]);

    renderDialog();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add team/i })).toBeInTheDocument();
    });
  });

  it('offers to add one in place when the directory is empty, rather than a link away', async () => {
    list.mockResolvedValue([]);

    renderDialog();

    // The empty-directory hint renders its "Add one" as a button only when
    // the caller can add without navigating; as a link otherwise, which
    // inside a dialog abandons whatever was typed into it.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add one/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /add one/i })).not.toBeInTheDocument();
  });
});
