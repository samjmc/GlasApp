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

// quizStorage imports ideologyApi only for defaultWeights; keep the Supabase client out of this test.
vi.mock('@/lib/ideologyApi', () => ({ defaultWeights: () => ({}) }));

const { AuthProvider, useAuth } = await import('./AuthContext');
const { loadDeviceSeed, loadDraft, loadStoredQuiz, storeDeviceSeed, storeDraft, storeQuiz } = await import('@/lib/quizStorage');

const SESSION = { user: { id: 'u1', email: 'aine@example.ie', user_metadata: {}, app_metadata: {} } };
const OTHER = { user: { id: 'u2', email: 'brian@example.ie', user_metadata: {}, app_metadata: {} } };

/** One person's quiz as a tab holds it: the result, its answers, the draft, and the device seed. */
function seedQuiz() {
  storeQuiz({ id: 7, vector: { economic: 1 }, ideology: 'x', description: 'y' } as never, [{ questionId: 1, answerIndex: 0 }] as never, 42);
  storeDraft({ seed: 42, answers: { 1: 2 } });
  storeDeviceSeed(99);
}

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
  window.sessionStorage.clear();
  window.localStorage.clear();
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

/**
 * The quiz result, its answers and the draft sit in the TAB's sessionStorage, and the next person to use
 * the tab would see the last one's political opinions on the results page. They go when the person goes.
 */
describe('AuthProvider and the quiz this tab holds', () => {
  it('drops the result, answers and draft on sign-out, and keeps the device seed', async () => {
    seedQuiz();
    renderSignedIn();
    await screen.findByText('signed in as u1');
    expect(loadStoredQuiz()).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await screen.findByText('signed out');
    expect(loadStoredQuiz()).toBeNull();
    expect(loadDraft()).toBeNull();
    expect(loadDeviceSeed()).toBe(99);
  });

  it('drops them even when Supabase fails to sign out', async () => {
    supa.signOutError = new Error('network');
    seedQuiz();
    renderSignedIn();
    await screen.findByText('signed in as u1');

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(loadStoredQuiz()).toBeNull());
    expect(loadDraft()).toBeNull();
  });

  it('drops them when a different person signs in on the same tab', async () => {
    seedQuiz();
    renderSignedIn();
    await screen.findByText('signed in as u1');

    act(() => supa.listener?.('SIGNED_IN', OTHER));

    expect(await screen.findByText('signed in as u2')).toBeInTheDocument();
    expect(loadStoredQuiz()).toBeNull();
    expect(loadDraft()).toBeNull();
  });

  it('keeps an anonymous result when a visitor signs in: it is saved to that account', async () => {
    supa.session = null;
    storeQuiz({ id: null, vector: { economic: 1 }, ideology: 'x', description: 'y' } as never, [{ questionId: 1, answerIndex: 0 }] as never, 42);
    storeDraft({ seed: 42, answers: { 1: 2 } });
    renderSignedIn();
    await screen.findByText('signed out');

    act(() => supa.listener?.('SIGNED_IN', SESSION));

    expect(await screen.findByText('signed in as u1')).toBeInTheDocument();
    expect(loadStoredQuiz()).not.toBeNull();
    expect(loadDraft()).not.toBeNull();
  });

  it('keeps them for the same person: a token refresh, a repeated sign-in event', async () => {
    seedQuiz();
    renderSignedIn();
    await screen.findByText('signed in as u1');
    act(() => supa.listener?.('TOKEN_REFRESHED', SESSION));
    act(() => supa.listener?.('SIGNED_IN', SESSION));
    expect(loadStoredQuiz()).not.toBeNull();
    expect(loadDraft()).not.toBeNull();
  });
});
