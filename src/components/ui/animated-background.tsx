import type { CSSProperties, ReactNode } from 'react';

/**
 * Aurora background — four slowly drifting light fields.
 *
 * Two ways to use it:
 * - `<AuroraBackground>…</AuroraBackground>` wraps content in its own aurora
 *   surface (hero sections, splash screens).
 * - `<AuroraBackdrop />` paints the aurora as a fixed layer behind the whole
 *   app. It is used this way in `NavShell` because wrapping the shell would
 *   introduce `overflow-hidden` and break the sticky sidebar and headers.
 *
 * `vivid` keeps the full-strength look; `ambient` is dialled well back so text
 * and data tables stay readable on top of it.
 */
export type AuroraVariant = 'ambient' | 'vivid';

/** Per-wave tint, drift animation, and how strongly it shows per variant. */
const WAVES: {
  gradient: string;
  animation: string;
  ambient: string;
  vivid: string;
}[] = [
  {
    // Brand emerald — the anchor hue.
    gradient: 'radial-gradient(ellipse 60vmax 45vmax at 50% 20%, rgba(45, 160, 118, 0.55) 0%, transparent 55%)',
    animation: 'aurora1 26s ease-in-out infinite alternate',
    ambient: 'opacity-[0.85] dark:opacity-[0.40]',
    vivid: 'opacity-100 dark:opacity-70',
  },
  {
    // Violet — mirrors the ILL badges used across the app.
    gradient: 'radial-gradient(ellipse 45vmax 30vmax at 80% 30%, rgba(139, 92, 246, 0.42) 0%, transparent 55%)',
    animation: 'aurora2 32s ease-in-out infinite alternate-reverse',
    ambient: 'opacity-[0.60] dark:opacity-[0.32]',
    vivid: 'opacity-80 dark:opacity-50',
  },
  {
    // Teal — cools the middle of the field.
    gradient: 'radial-gradient(ellipse 52vmax 38vmax at 20% 60%, rgba(20, 184, 166, 0.45) 0%, transparent 55%)',
    animation: 'aurora3 38s ease-in-out infinite alternate',
    ambient: 'opacity-[0.65] dark:opacity-[0.28]',
    vivid: 'opacity-80 dark:opacity-40',
  },
  {
    // Deep pine — grounds the lower edge.
    gradient: 'radial-gradient(ellipse 68vmax 23vmax at 60% 80%, rgba(31, 143, 104, 0.42) 0%, transparent 55%)',
    animation: 'aurora4 29s ease-in-out infinite alternate-reverse',
    ambient: 'opacity-[0.55] dark:opacity-[0.30]',
    vivid: 'opacity-70 dark:opacity-30',
  },
];

/** The drifting colour fields, shared by both wrappers. */
function AuroraLayers({ variant }: { variant: AuroraVariant }) {
  return (
    <>
      {/* Base wash. Light mode stays near-white so content keeps its contrast. */}
      <div
        className={
          variant === 'vivid'
            ? 'absolute inset-0 bg-gradient-to-br from-brand-100 via-white to-violet-100 dark:from-brand-950 dark:via-slate-950 dark:to-violet-950'
            : 'absolute inset-0 opacity-90 dark:opacity-60'
        }
      >
        {variant === 'ambient' && (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-200/70 via-transparent to-violet-200/60 dark:from-brand-900/25 dark:via-transparent dark:to-violet-900/20" />
        )}
      </div>

      {WAVES.map((wave, i) => (
        <div
          key={i}
          className={`absolute inset-0 ${variant === 'vivid' ? wave.vivid : wave.ambient}`}
          style={{ background: wave.gradient, animation: wave.animation } as CSSProperties}
        />
      ))}

      {/* Depth overlay so the top and bottom edges settle down. Kept nearly
          clear in light mode, where a white veil would just bleach the field. */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent dark:from-black/40 dark:via-transparent dark:to-black/20" />
    </>
  );
}

/**
 * Fixed aurora layer for the whole app. Sits above the page background colour
 * and below all content, and never intercepts clicks or printing.
 */
export function AuroraBackdrop({ variant = 'ambient' }: { variant?: AuroraVariant }) {
  return (
    <div className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <AuroraLayers variant={variant} />
    </div>
  );
}

export default function AuroraBackground({
  children,
  className = '',
  variant = 'vivid',
}: {
  children?: ReactNode;
  className?: string;
  variant?: AuroraVariant;
}) {
  return (
    <div className={`relative min-h-screen w-full overflow-hidden bg-white dark:bg-black ${className}`}>
      <div className="absolute inset-0" aria-hidden="true">
        <AuroraLayers variant={variant} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
