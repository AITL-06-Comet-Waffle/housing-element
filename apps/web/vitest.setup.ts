import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Unmount React trees and reset the DOM between tests so cases stay isolated.
afterEach(() => {
  cleanup();
});
