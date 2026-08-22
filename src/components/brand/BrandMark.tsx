/**
 * @file BrandMark.tsx
 * @description AgentSpace "Command Orbit" mark (2026-08-22 brand set, see
 * public/brand + design/brand). Inline SVG so it follows `currentColor`;
 * the same geometry is baked into src-tauri/icons via `tauri icon`.
 *
 * @module components/brand
 */

import type { CSSProperties } from 'react';

interface BrandMarkProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
  title?: string;
}

export function BrandMark({ size = 22, color = '#f8f8fb', style, title = 'AgentSpace' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      style={{ color, flexShrink: 0, ...style }}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="23" y="23" width="54" height="54" rx="15" strokeWidth="3.4" />
        <path d="M 50 18 A 32 32 0 0 1 82 50" strokeWidth="3.4" />
        <path d="M 50 82 A 32 32 0 0 1 18 50" strokeWidth="3.4" />
        <path d="M 34 58 Q 50 72 66 58" strokeWidth="2.6" opacity=".72" />
        <path d="M 34 42 Q 50 28 66 42" strokeWidth="2.6" opacity=".72" />
        <circle cx="50" cy="50" r="8" fill="currentColor" stroke="none" />
        <circle cx="50" cy="18" r="4.2" fill="currentColor" stroke="none" />
        <circle cx="82" cy="50" r="4.2" fill="currentColor" stroke="none" />
        <circle cx="50" cy="82" r="4.2" fill="currentColor" stroke="none" />
        <circle cx="18" cy="50" r="4.2" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

/** Mark + wordmark, the lockup used in the top bar and the home screen. */
export function BrandLockup({ markSize = 24, fontSize = 17, gap = 10, style }: {
  markSize?: number; fontSize?: number; gap?: number; style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, ...style }}>
      <BrandMark size={markSize} />
      <span style={{ fontSize, fontWeight: 750, color: '#f8f8fb', letterSpacing: 0.2, lineHeight: 1 }}>
        AgentSpace
      </span>
    </div>
  );
}
