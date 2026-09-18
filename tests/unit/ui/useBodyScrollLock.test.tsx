// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBodyScrollLock } from '../../../src/ui/primitives/useBodyScrollLock';

afterEach(cleanup);
afterEach(() => { document.body.style.overflow = ''; });

function Locker() {
  useBodyScrollLock();
  return null;
}

describe('useBodyScrollLock (person\'s own follow-up report: "I can still scroll the background... when the event log shows up")', () => {
  it('locks document.body scroll while mounted and restores the prior value on unmount', () => {
    expect(document.body.style.overflow).toBe('');
    const { unmount } = render(<Locker />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores whatever value was already set, not just the empty default', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(<Locker />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('keeps the body locked when a second, nested lock (e.g. Session Summary\'s own Event Log popup) unmounts before the outer one does', () => {
    expect(document.body.style.overflow).toBe('');
    const outer = render(<Locker />);
    expect(document.body.style.overflow).toBe('hidden');
    const inner = render(<Locker />);
    expect(document.body.style.overflow).toBe('hidden');
    // The inner (Event Log) overlay closes first - the outer (Session Summary) is still open, so the
    // body must stay locked, not fall back to whatever was there before either ever mounted.
    inner.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    outer.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
