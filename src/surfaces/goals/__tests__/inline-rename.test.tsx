/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineTitle } from '../InlineTitle';

describe('InlineTitle rename', () => {
  it('calls onSave with new name on Enter key press', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <InlineTitle
        value="Original Name"
        onSave={onSave}
      />
    );

    // Click the title to enter edit mode
    const title = screen.getByRole('button', { name: /Original Name/i });
    await user.click(title);

    // Find the input and type new name
    const input = screen.getByDisplayValue('Original Name') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'New Name');

    // Press Enter to save
    await user.keyboard('{Enter}');

    // Verify onSave was called with new name
    expect(onSave).toHaveBeenCalledWith('New Name');
  });

  it('does not call onSave when name unchanged', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <InlineTitle
        value="Unchanged Name"
        onSave={onSave}
      />
    );

    // Click to edit
    const title = screen.getByRole('button', { name: /Unchanged Name/i });
    await user.click(title);

    // Find input but don't change value
    const input = screen.getByDisplayValue('Unchanged Name');

    // Press Enter without changing
    await user.keyboard('{Enter}');

    // Verify onSave was NOT called
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels edit on Escape key', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <InlineTitle
        value="Original"
        onSave={onSave}
      />
    );

    // Click to edit
    const title = screen.getByRole('button', { name: /Original/i });
    await user.click(title);

    // Type new value
    const input = screen.getByDisplayValue('Original') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'Changed');

    // Press Escape
    await user.keyboard('{Escape}');

    // Verify onSave was not called and value reverted
    expect(onSave).not.toHaveBeenCalled();
    // Title should be back to original value
    expect(screen.getByRole('button', { name: /Original/i })).toBeInTheDocument();
  });

  it('calls onSave with trimmed name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <InlineTitle
        value="Original"
        onSave={onSave}
      />
    );

    // Click to edit
    const title = screen.getByRole('button', { name: /Original/i });
    await user.click(title);

    // Type name with spaces
    const input = screen.getByDisplayValue('Original') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '  Trimmed Name  ');

    // Press Enter
    await user.keyboard('{Enter}');

    // Verify onSave was called with trimmed name
    expect(onSave).toHaveBeenCalledWith('Trimmed Name');
  });
});
