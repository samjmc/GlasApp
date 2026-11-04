// @vitest-environment jsdom
/**
 * The cookie notice has nothing to opt in to (no analytics), so it offers one OK button, never an
 * accept/reject pair, and once acknowledged it stays away.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CookieConsent from './CookieConsent';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const showNotice = () => act(() => vi.advanceTimersByTime(1000));

describe('CookieConsent', () => {
  it('shows one button, OK, and remembers it was pressed', () => {
    render(<CookieConsent />);
    expect(screen.queryByRole('region', { name: 'Cookie notice' })).not.toBeInTheDocument();
    showNotice();

    const notice = screen.getByRole('region', { name: 'Cookie notice' });
    const buttons = Array.from(notice.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).toEqual(['OK']);

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('region', { name: 'Cookie notice' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('cookie_consent')!)).toEqual({ essential: true });
  });

  it('does not show again once acknowledged', () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true }));
    render(<CookieConsent />);
    showNotice();
    expect(screen.queryByRole('region', { name: 'Cookie notice' })).not.toBeInTheDocument();
  });
});
