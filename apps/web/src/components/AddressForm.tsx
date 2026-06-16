'use client';

import { useState, type FormEvent } from 'react';

interface AddressFormProps {
  /** Called with the trimmed, non-empty address when the user submits. */
  onSubmit: (address: string) => void;
  /** When true, the field and button are disabled (e.g. while a lookup is in flight). */
  disabled?: boolean;
}

/** Street-address input + submit button. Submits the trimmed, non-empty address. */
export function AddressForm({ onSubmit, disabled = false }: AddressFormProps) {
  const [address, setAddress] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        disabled={disabled}
        placeholder="Enter a California street address…"
        aria-label="Street address"
        className="flex-1 rounded border border-gray-300 px-3 py-2 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        Check risk
      </button>
    </form>
  );
}
