'use client';
import { useState } from 'react';

type Props = {
  size?: number;
  alt?: string;
  /** Render only the icon mark, no wordmark. Useful in compact contexts. */
  iconOnly?: boolean;
  /** Render only the wordmark, no icon. */
  wordmarkOnly?: boolean;
};

/**
 * Fynd brand logo composed of two pieces:
 *   - icon:     /fynd-icon.png  (the interlocked geometric mark)
 *   - wordmark: /fynd-logo.svg  (the lowercase "fynd" wordmark)
 *
 * The icon is the more distinctive piece, so the component prefers showing both
 * side-by-side when possible. Falls back gracefully:
 *   icon.png missing       → wordmark only
 *   wordmark.svg missing   → icon only
 *   both missing           → text "fynd" wordmark
 *
 * To use the real brand assets:
 *   1. Drop the icon mark at public/fynd-icon.png (transparent bg, ≥256 px square)
 *   2. Optionally drop a custom wordmark at public/fynd-logo.svg
 *   No code change needed — the component picks them up at runtime.
 */
export function FyndLogo({ size = 32, alt = 'Fynd', iconOnly = false, wordmarkOnly = false }: Props) {
  const [iconOk, setIconOk] = useState(true);
  const [wordOk, setWordOk] = useState(true);

  const showIcon = !wordmarkOnly && iconOk;
  const showWord = !iconOnly && wordOk;
  const bothMissing = !showIcon && !showWord;

  if (bothMissing) {
    return (
      <span
        style={{
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: Math.round(size * 0.7),
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#0f172a',
        }}
      >
        fynd
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.25) }}>
      {showIcon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/fynd-icon.png"
          alt={showWord ? '' : alt}
          aria-hidden={showWord || undefined}
          height={size}
          style={{ height: size, width: 'auto', display: 'block' }}
          onError={() => setIconOk(false)}
        />
      ) : null}
      {showWord ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/fynd-logo.svg"
          alt={showIcon ? '' : alt}
          aria-hidden={showIcon || undefined}
          height={Math.round(size * 0.9)}
          style={{ height: Math.round(size * 0.9), width: 'auto', display: 'block' }}
          onError={() => setWordOk(false)}
        />
      ) : null}
    </span>
  );
}
