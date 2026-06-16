import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressForm } from './AddressForm';

describe('AddressForm', () => {
  it('calls onSubmit with the trimmed address', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox', { name: 'Street address' }), '  1 Main St, Davis CA  ');
    await user.click(screen.getByRole('button', { name: 'Check risk' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('1 Main St, Davis CA');
  });

  it('does not call onSubmit for whitespace-only input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox', { name: 'Street address' }), '   ');
    await user.click(screen.getByRole('button', { name: 'Check risk' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the typed address visible after submit', async () => {
    const user = userEvent.setup();
    render(<AddressForm onSubmit={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Street address' });
    await user.type(input, '1 Main St');
    await user.click(screen.getByRole('button', { name: 'Check risk' }));

    expect(input).toHaveValue('1 Main St');
  });

  it('disables the field and button when disabled', () => {
    render(<AddressForm onSubmit={vi.fn()} disabled />);

    expect(screen.getByRole('textbox', { name: 'Street address' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check risk' })).toBeDisabled();
  });
});
