// @vitest-environment jsdom
/**
 * The profile page reads the name, county and bio from politics.users (GET /api/profile/me) and
 * saves them there (PATCH), never to the sign-in's Supabase `user_metadata`.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateUser = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { updateUser, getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

// One object, as the real provider keeps it between renders.
const auth = vi.hoisted(() => ({
  user: { id: 'u1', email: 'maire@example.ie', username: 'maire', hasSeenOnboarding: true },
  isAuthenticated: true,
  logout: async () => {},
  deleteAccount: async () => {},
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/ConsentContext', () => ({
  usePoliticalConsent: () => ({ granted: true, known: true, grant: vi.fn(), withdraw: vi.fn() }),
}));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }) }));
vi.mock('@/hooks/useRegion', () => ({ useRegion: () => ({ regionCode: 'IE', selectRegion: vi.fn() }) }));
vi.mock('@/lib/ideologyApi', () => ({ fetchMyQuizResults: vi.fn(async () => []) }));

const apiCall = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), apiCall }));

const { default: ProfilePage } = await import('./ProfilePage');

const ROW = { id: 'u1', firstName: 'Máire', lastName: null, county: 'Galway', bio: 'Hello', profileImageUrl: null, email: 'maire@example.ie' };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  updateUser.mockClear();
  apiCall.mockReset();
  apiCall.mockImplementation(async (method: string, path: string, body?: Record<string, string>) => {
    if (method === 'GET' && path === '/api/profile/me') return { user: ROW, isAdmin: false };
    if (method === 'PATCH' && path === '/api/profile/me') return { user: { ...ROW, ...body } };
    throw new Error(`unexpected ${method} ${path}`);
  });
});

describe('ProfilePage save', () => {
  it('shows the saved row, and saves edits with PATCH /api/profile/me, not to user_metadata', async () => {
    const queryClient = renderPage();
    expect(await screen.findByDisplayValue('Máire')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Galway')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    await userEvent.type(screen.getByLabelText('Last name'), 'Ní Bhriain');
    await userEvent.clear(screen.getByLabelText('Bio'));
    await userEvent.type(screen.getByLabelText('Bio'), 'Dia duit');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiCall.mock.calls.filter(([m]) => m === 'PATCH')).toHaveLength(1));
    expect(apiCall).toHaveBeenCalledWith('PATCH', '/api/profile/me', { firstName: 'Máire', lastName: 'Ní Bhriain', county: 'Galway', bio: 'Dia duit' });
    expect(updateUser).not.toHaveBeenCalled();

    // Back to reading, showing what the server saved, and every reader of the profile has it.
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ní Bhriain')).toBeInTheDocument();
    expect(queryClient.getQueryData<{ user: typeof ROW }>(['/api/profile/me', 'u1'])?.user).toMatchObject({ lastName: 'Ní Bhriain', bio: 'Dia duit' });
  });

  it('cannot be edited before the saved profile has loaded, so blanks are never saved over it', async () => {
    apiCall.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeDisabled();
  });
});
