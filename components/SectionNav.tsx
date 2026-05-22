/**
 * Sticky in-page navigation. The dashboard is ~6,000px tall; this lets a viewer
 * jump straight to any section.
 *
 * Pure anchor links — the section <a href="#id"> + the matching id on each
 * `.dash-section` is the most robust in-page jump there is. `scroll-margin-top`
 * on `.dash-section` keeps the sticky bar from covering a section title, and
 * `html { scroll-behavior: smooth }` animates the jump. No JS required.
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
  return (
    <nav className="section-nav" aria-label="Jump to section">
      <span className="section-nav-label">Jump to</span>
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="section-nav-link">
          {s.label}
        </a>
      ))}
    </nav>
  );
}
