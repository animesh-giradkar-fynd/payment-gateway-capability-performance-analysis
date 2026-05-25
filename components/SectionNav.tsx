'use client';
import { useEffect, useState } from 'react';

/**
 * Sticky in-page navigation. The dashboard is ~6,000px tall; this lets a viewer
 * jump straight to any section.
 *
 * Pure anchor links — the section <a href="#id"> + the matching id on each
 * `.dash-section` is the most robust in-page jump there is. `scroll-margin-top`
 * on `.dash-section` keeps the sticky bar from covering a section title, and
 * `html { scroll-behavior: smooth }` animates the jump.
 *
 * Now also tracks the in-view section via IntersectionObserver and highlights
 * the matching link — so a viewer scrolling through the page can tell at a
 * glance which section they're reading. Falls back gracefully on older browsers
 * (the observer is a no-op; the static anchor links still work).
 */
const SECTIONS = [
  { id: 'sec-kpis', label: 'KPIs' },
  { id: 'sec-gateways', label: 'Gateways' },
  { id: 'sec-methods', label: 'Payment methods' },
  { id: 'sec-failures', label: 'Failures & refunds' },
  { id: 'sec-regional', label: 'Regional' },
  { id: 'sec-surface', label: 'Surfaces' },
  { id: 'sec-capabilities', label: 'Capabilities' },
];

export function SectionNav() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    // Pick whichever section has the largest intersection ratio. rootMargin pulls
    // the trigger zone down 30% from the top so a section "counts as active" once
    // its content (not just its top edge) is on screen.
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        setActiveId(top.target.id);
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.1, 0.5, 1] },
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="section-nav" aria-label="Jump to section">
      <span className="section-nav-label">Jump to</span>
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`section-nav-link${activeId === s.id ? ' section-nav-link-active' : ''}`}
          aria-current={activeId === s.id ? 'true' : undefined}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
