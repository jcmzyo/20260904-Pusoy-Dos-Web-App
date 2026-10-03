// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventLogOverlay } from '../../../src/ui/primitives/EventLogOverlay';
import { DiscardPileOverlay } from '../../../src/ui/primitives/DiscardPileOverlay';
import { LeaveConfirmOverlay } from '../../../src/ui/primitives/LeaveConfirmOverlay';
import { useBodyScrollLock } from '../../../src/ui/primitives/useBodyScrollLock';

afterEach(cleanup);

describe('M5-T05 dismissible dialog focus', () => {
  it.each(['Event Log', 'Discard Pile'])('%s focuses its scrollable body and wraps both keyboard boundaries', (title) => {
    render(<StrictMode>{title === 'Event Log'
      ? <EventLogOverlay events={[]} names={{}} onClose={() => {}} />
      : <DiscardPileOverlay cards={[]} onClose={() => {}} />}</StrictMode>);
    const body = screen.getByRole('region', { name: `${title} content` });
    const close = screen.getByRole('button', { name: `Close ${title}` });
    expect(document.activeElement).toBe(body);
    fireEvent.keyDown(body, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(body);
  });

  it('Leave focuses Stay, traps focus, and Escape only cancels', () => {
    const onStay = vi.fn();
    const onLeave = vi.fn();
    render(<LeaveConfirmOverlay onStay={onStay} onLeave={onLeave} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay' }));
    const leave = screen.getByRole('button', { name: 'Yes, Leave Game' });
    leave.focus();
    fireEvent.keyDown(leave, { key: 'Tab' });
    const close = screen.getByRole('button', { name: 'Close Leave Game' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(leave);
    fireEvent.keyDown(leave, { key: 'Escape' });
    expect(onStay).toHaveBeenCalledOnce();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it.each([false, true])('returns focus after close, falling back to the hand when opener removed: %s', (removeOpener) => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <>
        {!(open && removeOpener) && <button onClick={() => setOpen(true)}>Open</button>}
        <div role="listbox" aria-label="Your hand"><div role="option" tabIndex={0}>3 of Clubs</div></div>
        {open && <DiscardPileOverlay cards={[]} onClose={() => setOpen(false)} />}
      </>;
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.activeElement).toBe(removeOpener ? screen.getByRole('option') : opener);
  });

  it('does not steal focus or handle Escape/Tab behind an unsupported gate', () => {
    const close = vi.fn();
    render(<><button>Notice</button><div inert><DiscardPileOverlay cards={[]} onClose={close} /></div></>);
    const notice = screen.getByRole('button', { name: 'Notice' });
    notice.focus();
    fireEvent.keyDown(notice, { key: 'Tab' });
    fireEvent.keyDown(notice, { key: 'Escape' });
    expect(document.activeElement).toBe(notice);
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps scroll locked until the last modal unmounts even when removed out of acquisition order', () => {
    function Lock() { useBodyScrollLock(); return null; }
    document.body.style.overflow = 'auto';
    const { rerender, unmount } = render(<StrictMode><Lock key="first" /><Lock key="second" /></StrictMode>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<StrictMode><Lock key="second" /></StrictMode>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });
});
