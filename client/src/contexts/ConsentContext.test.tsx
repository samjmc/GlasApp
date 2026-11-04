// @vitest-environment jsdom
/**
 * ConsentProvider: `ensure` asks the server (never the cached profile) and opens the dialog only
 * when the user has not agreed to the current wording; `withdraw` erases on the server and drops
 * every cached copy of their data.
 */
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLITICAL_CONSENT_VERSION } from '@shared/consent';

const server = vi.hoisted(() => ({ consented: false }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}));

const apiCall = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), apiCall }));

const { ConsentProvider, usePoliticalConsent } = await import('./ConsentContext');

const CONSENTED = { politicalConsentAt: '2026-10-01T00:00:00Z', politicalConsentVersion: POLITICAL_CONSENT_VERSION };

function Saver() {
  const { ensure, withdraw } = usePoliticalConsent();
  const [answer, setAnswer] = useState('');
  return (
    <div>
      <button onClick={async () => setAnswer(String(await ensure()))}>Save</button>
      <button onClick={async () => setAnswer(String(await ensure({ respectDecline: true })))}>Save quietly</button>
      <button onClick={() => void withdraw()}>Withdraw</button>
      <p>answer: {answer}</p>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['/api/quiz/me', 'u1'], [{ id: 1 }]);
  render(
    <QueryClientProvider client={queryClient}>
      <ConsentProvider>
        <Saver />
      </ConsentProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

const calls = (method: string) => apiCall.mock.calls.filter(([m]) => m === method);

beforeEach(() => {
  server.consented = false;
  apiCall.mockReset();
  apiCall.mockImplementation(async (method: string, path: string) => {
    if (method === 'GET' && path === '/api/profile/me') return { user: server.consented ? CONSENTED : {} };
    if (method === 'PUT') {
      server.consented = true;
      return {};
    }
    if (method === 'DELETE') {
      server.consented = false;
      return {};
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
});

describe('ConsentProvider.ensure', () => {
  it('resolves true without a dialog when the server says the user agreed', async () => {
    server.consented = true;
    renderProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('answer: true')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks, saves the agreement for the current wording, then resolves true', async () => {
    renderProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Can we keep your political opinions?');

    await userEvent.click(screen.getByRole('button', { name: 'I agree' }));

    expect(await screen.findByText('answer: true')).toBeInTheDocument();
    expect(calls('PUT')).toEqual([['PUT', '/api/account/consent/political', { version: POLITICAL_CONSENT_VERSION }]]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resolves false on "Not now", and a later quiet save does not ask again', async () => {
    renderProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(await screen.findByText('answer: false')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save quietly' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls('PUT')).toHaveLength(0);
  });
});

describe('ConsentProvider.withdraw', () => {
  it('deletes on the server and marks every cached query stale', async () => {
    server.consented = true;
    const queryClient = renderProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(calls('DELETE')).toEqual([['DELETE', '/api/account/consent/political']]));
    await waitFor(() => expect(queryClient.getQueryState(['/api/quiz/me', 'u1'])?.isInvalidated).toBe(true));
  });
});
