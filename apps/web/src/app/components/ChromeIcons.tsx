// Exact vendor icon paths (not hand-approximated) so the "find the
// extension" illustrations on /support and /dashboard match real Chrome UI
// pixel-for-pixel instead of a rough lookalike.
//
// PuzzlePieceIcon: Chromium's own "chrome_extension" vector icon
// (google/chromium, components/vector_icons/chrome_extension.icon,
// BSD-3-Clause, Copyright The Chromium Authors) - this is the actual glyph
// Chrome itself renders for the Extensions toolbar button.
// PinIcon: Lucide's "pin" icon (ISC license) - matches the real pin-to-
// toolbar affordance shown in Chrome's extensions dropdown.
export function PuzzlePieceIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      style={{ verticalAlign: -2 }}
    >
      <path
        fillRule="nonzero"
        d="M4.5 17 c-0.41 0 -0.77 -0.15 -1.06 -0.44 A1.44 1.44 0 0 1 3 15.5 v-2.89 c0 -0.18 0.06 -0.34 0.17 -0.48 a0.65 0.65 0 0 1 0.44 -0.25 a2.28 2.28 0 0 0 1 -0.73 C4.87 10.81 5 10.43 5 10 c0 -0.43 -0.13 -0.81 -0.39 -1.14 a2.28 2.28 0 0 0 -1 -0.73 a0.64 0.64 0 0 1 -0.44 -0.25 A0.78 0.78 0 0 1 3 7.38 V4.5 c0 -0.41 0.15 -0.77 0.44 -1.06 A1.44 1.44 0 0 1 4.5 3 H8 c0 -0.56 0.19 -1.03 0.58 -1.42 A1.93 1.93 0 0 1 10 1 c0.56 0 1.03 0.19 1.42 0.58 c0.39 0.39 0.58 0.86 0.58 1.42 h3.5 c0.41 0 0.77 0.15 1.06 0.44 c0.29 0.29 0.44 0.65 0.44 1.06 V8 a1.94 1.94 0 0 1 1.42 0.58 c0.39 0.39 0.58 0.86 0.58 1.42 c0 0.56 -0.19 1.03 -0.58 1.42 A1.94 1.94 0 0 1 17 12 v3.5 c0 0.41 -0.15 0.77 -0.44 1.06 A1.44 1.44 0 0 1 15.5 17 Z m0 -1.5 h11 v-11 h-11 v2.33 a3.23 3.23 0 0 1 1.47 1.28 C6.32 8.69 6.5 9.32 6.5 10 c0 0.7 -0.18 1.33 -0.53 1.91 A3.12 3.12 0 0 1 4.5 13.17 Z M10 10 Z"
      />
    </svg>
  );
}

export function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

// The real logo (matches apps/web/public/logo.svg exactly) - used inline
// in these illustrations instead of a generic placeholder icon so the
// "AI Checker" row in the mocked Extensions dropdown actually shows our
// own mark, not a magnifying-glass stand-in.
export function LogoBadge({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#3d6fe0" />
      <rect x="6.5" y="19.4" width="14" height="2.4" rx="1.2" fill="#fff" />
      <rect x="6.5" y="24.4" width="9" height="2.4" rx="1.2" fill="#fff" opacity="0.75" />
      <circle cx="19.5" cy="12" r="6" fill="none" stroke="#fff" strokeWidth="1.8" />
      <line x1="23.7" y1="16.2" x2="27" y2="19.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
