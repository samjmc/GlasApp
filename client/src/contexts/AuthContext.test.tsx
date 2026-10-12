// @vitest-environment jsdom
/**
 * The query cache holds one person's data with no expiry, so signing out must empty it (client F7).
 * Supabase is replaced by a stub that, like the real client, reports SIGNED_OUT to the listener.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const supa = vi.hoisted(() => ({
  session: null as unknown,
  listener: null as null | ((event: string, session: unknown) => void),
  signOutError: null as unknown,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: supa.session } })),
      onAuthStateChange: vi.fn((listener: (event: string, session: unknown) => void) => {
        supa.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => {
        if (supa.signOutError) return { error: supa.signOutError };
        supa.listener?.('SIGNED_OUT', null);
        return { error: null };
      }),
    },
  },
}));

const { AuthProvider, useAuth } = await import('./AuthContext');

const SESSION = { user: { id: 'u1', email: 'aine@example.ie', user_metadata: {}, app_metadata: {} } };

function Account() {
  const { user, logout } = useAuth();
  return (
    <div>
      <p>{user ? `signed in as ${user.id}` : 'signed out'}</p>
      <button onClick={() => logout().catch(() => {})}>Sign out</button>
    </div>
  );
}

function renderSignedIn() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['/api/daily-session', 'u1'], { votes: 3 });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Account />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  supa.session = SESSION;
  supa.listener = null;
  supa.signOutError = null;
});

describe('AuthProvider sign-out', () => {
  it('empties the query cache and forgets the user', async () => {
    const queryClient = renderSignedIn();
    expect(await screen.findByText('signed in as u1')).toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('empties the cache even when Supabase fails to sign out', async () => {
    supa.signOutError = new Error('network');
    const queryClient = renderSignedIn();
    await screen.findByText('signed in as u1');

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
    expect(screen.getByText('signed out')).toBeInTheDocument();
  });

  it('keeps the cache when the same person is sent again (a token refresh)', async () => {
    const queryClient = renderSignedIn();
    await screen.findByText('signed in as u1');
    act(() => supa.listener?.('TOKEN_REFRESHED', SESSION));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  });
});
