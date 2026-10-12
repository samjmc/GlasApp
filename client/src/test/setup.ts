// Loaded before every vitest file (vitest.config.ts). Adds the DOM matchers (toBeInTheDocument, …)
// for component tests; a file opts into a browser-like DOM with `// @vitest-environment jsdom`.
import '@testing-library/jest-dom/vitest';
