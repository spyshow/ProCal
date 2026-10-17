// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PricingSection } from './PricingSection';

afterEach(() => {
  cleanup();
});

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    isRtl: false,
    locale: 'en',
  }),
}));

describe('PricingSection — Feasab-style Credit Packs', () => {
  it('renders the 3 one-off credit packs ($49, $99, $249) with /billing?credits=1|3|10 links', () => {
    const { container } = render(<PricingSection />);

    expect(screen.getAllByText('Single Project').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('3 Projects').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10 Projects').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('3 projects • $33 a project • save 33%')).toBeTruthy();
    expect(screen.getByText('10 projects • $25 a project • save 49%')).toBeTruthy();

    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/billing?credits=1');
    expect(hrefs).toContain('/billing?credits=3');
    expect(hrefs).toContain('/billing?credits=10');
  });

  it('renders the side-by-side comparison table and interactive FAQ accordion', () => {
    render(<PricingSection />);

    expect(screen.getByText('Everything side by side')).toBeTruthy();
    expect(screen.getByText('Price per project')).toBeTruthy();
    expect(screen.getByText('Automatic renewal')).toBeTruthy();

    // First FAQ question is open by default
    expect(
      screen.getByText(/One credit unlocks one complete electrical engineering project in ProCal/i)
    ).toBeTruthy();

    // Click second FAQ question to expand it
    const q2Btn = screen.getByRole('button', { name: /Do packs renew automatically\?/i });
    fireEvent.click(q2Btn);
    expect(
      screen.getByText(/Every credit pack is a one-off purchase with zero recurring billing/i)
    ).toBeTruthy();
  });
});
