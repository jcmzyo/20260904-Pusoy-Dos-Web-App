import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

export function useResultFocus() {
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!panelRef.current?.closest('[inert]')) headingRef.current?.focus({ preventScroll: true });
  }, []);

  function containFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || panelRef.current?.closest('[inert]')) return;
    const stops = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
    const index = stops.indexOf(document.activeElement as HTMLElement);
    if (index === -1 || (!event.shiftKey && index === stops.length - 1) || (event.shiftKey && index === 0)) {
      event.preventDefault();
      (event.shiftKey ? stops[stops.length - 1] : stops[0])?.focus();
      if (stops.length === 0) headingRef.current?.focus();
    }
  }

  return { panelRef, headingRef, containFocus };
}
