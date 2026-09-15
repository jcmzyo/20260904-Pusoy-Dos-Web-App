// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CardBack, PlayingCard } from '../../../src/ui/primitives/Card';

afterEach(cleanup);

describe('PlayingCard and CardBack visual primitives', () => {
  it('exposes a semantic rank-and-suit label for every suit', () => {
    render(
      <>
        <PlayingCard card={{ rank: '3', suit: 'clubs' }} />
        <PlayingCard card={{ rank: 'K', suit: 'spades' }} />
        <PlayingCard card={{ rank: 'A', suit: 'hearts' }} />
        <PlayingCard card={{ rank: '2', suit: 'diamonds' }} />
      </>,
    );
    expect(screen.getByRole('img', { name: '3 of Clubs' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'K of Spades' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'A of Hearts' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '2 of Diamonds' })).toBeTruthy();
  });

  it('never renders a raster card-image element', () => {
    render(<PlayingCard card={{ rank: '10', suit: 'hearts' }} />);
    expect(document.querySelectorAll('img').length).toBe(0);
    expect(document.querySelectorAll('svg image').length).toBe(0);
  });

  it('gives every suit its own styling hook so suits remain visually distinguishable', () => {
    render(
      <>
        <PlayingCard card={{ rank: '5', suit: 'clubs' }} />
        <PlayingCard card={{ rank: '5', suit: 'spades' }} />
        <PlayingCard card={{ rank: '5', suit: 'hearts' }} />
        <PlayingCard card={{ rank: '5', suit: 'diamonds' }} />
      </>,
    );
    const classNames = ['Clubs', 'Spades', 'Hearts', 'Diamonds'].map(
      (label) => screen.getByRole('img', { name: `5 of ${label}` }).className,
    );
    expect(new Set(classNames).size).toBe(4);
  });

  it('decorates rank/suit glyphs as presentational so assistive tech reads only the one card label', () => {
    render(<PlayingCard card={{ rank: 'Q', suit: 'diamonds' }} />);
    const card = screen.getByRole('img', { name: 'Q of Diamonds' });
    const decorative = card.querySelectorAll('[aria-hidden="true"]');
    expect(decorative.length).toBeGreaterThan(0);
    decorative.forEach((node) => expect(node.getAttribute('aria-label')).toBeNull());
  });

  it('applies a width override while the aspect ratio remains fixed in CSS', () => {
    render(<PlayingCard card={{ rank: '7', suit: 'clubs' }} widthPx={40} />);
    const card = screen.getByRole('img', { name: '7 of Clubs' });
    expect(card.style.width).toBe('40px');
  });

  it('renders a face-down back that exposes no rank or suit information', () => {
    render(<CardBack />);
    const back = screen.getByRole('img', { name: 'Face-down card' });
    expect(back.textContent).toBe('');
  });

  it('applies a width override to the card back as well', () => {
    render(<CardBack widthPx={32} />);
    expect(screen.getByRole('img', { name: 'Face-down card' }).style.width).toBe('32px');
  });
});
