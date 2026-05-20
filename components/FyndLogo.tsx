'use client';
import { useState } from 'react';

type Props = {
  size?: number;
  alt?: string;
};

/**
 * Renders the Fynd brand logo. Prefers /fynd-logo.png (the real high-res brand asset
 * dropped into public/), falls back to /fynd-logo.svg (the wordmark placeholder) if
 * the PNG isn't present. Falls back to a text wordmark if both fail.
 *
 * To use the real brand asset: drop the PNG at public/fynd-logo.png. No code change needed.
 */
export function FyndLogo({ size = 48, alt = 'Fynd' }: Props) {
  const [stage, setStage] = useState<'png' | 'svg' | 'text'>('png');

  if (stage === 'text') {
    return (
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: Math.round(size * 0.7),
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: '#fa3e7d',
        }}
      >
        fynd
      </span>
    );
  }

  const src = stage === 'png' ? '/fynd-logo.png' : '/fynd-logo.svg';

  return (
    // Plain <img> on purpose: next/image throws on 404, but we want a graceful
    // png → svg → text fallback chain so the page never breaks if the brand asset
    // hasn't been dropped yet.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      height={size}
      style={{ height: size, width: 'auto', display: 'block' }}
      onError={() => setStage((s) => (s === 'png' ? 'svg' : 'text'))}
    />
  );
}
