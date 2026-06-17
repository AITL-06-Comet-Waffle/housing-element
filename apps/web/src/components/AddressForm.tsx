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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="text"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        disabled={disabled}
        placeholder="Enter a California street address…"
        aria-label="Street address"
        className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-sky-500 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
      >
        Check risk
      </button>
    </form>
  );
}
