import type React from 'react';
import { cn } from '@/lib/utils';

/**
 * Elegant gradient backdrop — a soft corner-lit gradient, skewed light
 * streaks, film grain, and a fine dot grid.
 *
 * Two ways to use it:
 * - `<DarkGradientBg>…</DarkGradientBg>` wraps content on its own surface.
 * - `<ElegantBackdrop />` paints it as a fixed layer behind the whole app,
 *   which is how `NavShell` uses it. Wrapping the shell would add
 *   `overflow-hidden` and break the sticky sidebar and headers.
 *
 * The source pattern is black-only. This app ships a light/dark toggle, so
 * each layer carries a light counterpart: the same geometry, inverted tones.
 */

/** Per-streak mask. Each is skewed 45° so the light reads as a diagonal shaft. */
const STREAK_MASKS = [
  'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 20%, rgba(0,0,0,0) 36%, rgb(0,0,0) 55%, rgba(0,0,0,0.13) 67%, rgb(0,0,0) 78%, rgba(0,0,0,0) 97%)',
  'linear-gradient(90deg, rgba(0,0,0,0) 11%, rgb(0,0,0) 25%, rgba(0,0,0,0.55) 41%, rgba(0,0,0,0.13) 67%, rgb(0,0,0) 78%, rgba(0,0,0,0) 97%)',
  'linear-gradient(90deg, rgba(0,0,0,0) 9%, rgb(0,0,0) 20%, rgba(0,0,0,0.55) 28%, rgba(0,0,0,0.424) 40%, rgb(0,0,0) 48%, rgba(0,0,0,0.267) 54%, rgba(0,0,0,0.13) 78%, rgb(0,0,0) 88%, rgba(0,0,0,0) 97%)',
  'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 17%, rgba(0,0,0,0.55) 26%, rgb(0,0,0) 35%, rgba(0,0,0,0) 47%, rgba(0,0,0,0.13) 69%, rgb(0,0,0) 79%, rgba(0,0,0,0) 97%)',
  'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgb(0,0,0) 20%, rgba(0,0,0,0.55) 27%, rgb(0,0,0) 42%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.13) 67%, rgb(0,0,0) 74%, rgb(0,0,0) 82%, rgba(0,0,0,0.47) 88%, rgba(0,0,0,0) 97%)',
];

/**
 * Self-contained film grain. The original pointed at a Framer CDN PNG; an
 * offline-capable PWA cannot depend on a remote host (and the service worker
 * deliberately never caches cross-origin), so the texture is generated inline.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Streak tint. Cyan over the dark theme, a deeper teal so it stays visible on white. */
function Streaks({ light }: { light?: boolean }) {
  const tint = light
    ? 'linear-gradient(rgb(8, 145, 178) 0%, rgba(8, 145, 178, 0) 100%)'
    : 'linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)';
  return (
    <>
      {STREAK_MASKS.map((mask, i) => (
        <div
          key={i}
          className={light ? 'absolute inset-0 opacity-[0.18]' : 'absolute inset-0 opacity-20'}
          style={{
            background: tint,
            mask,
            WebkitMask: mask,
            transform: 'skewX(45deg)',
          }}
        />
      ))}
    </>
  );
}

function PatternLayers() {
  const baseMask =
    'radial-gradient(125% 100% at 0% 0%, rgb(0,0,0) 0%, rgba(0,0,0,0.224) 88.2883%, rgba(0,0,0,0) 100%)';
  return (
    <>
      {/* Corner-lit base — charcoal in dark, a cool off-white in light. */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background: 'radial-gradient(100% 100% at 0% 0%, rgb(46, 46, 46) 0%, rgb(0, 0, 0) 100%)',
            mask: baseMask,
            WebkitMask: baseMask,
          }}
        >
          <Streaks />
        </div>
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            background: 'radial-gradient(100% 100% at 0% 0%, rgb(255, 255, 255) 0%, rgb(226, 232, 240) 100%)',
            mask: baseMask,
            WebkitMask: baseMask,
          }}
        >
          <Streaks light />
        </div>
      </div>

      {/* Film grain. */}
      <div
        className="absolute inset-0 opacity-[0.05] bg-repeat dark:opacity-[0.05]"
        style={{ backgroundImage: GRAIN, backgroundSize: '149.76px' }}
      />

      {/* Dot grid — light dots on dark, ink dots on light. */}
      <div
        className="absolute inset-0 hidden opacity-20 dark:block"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.13] dark:hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.55) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Radial highlight. Tailwind has no bg-gradient-radial utility, so this
          is an inline gradient rather than a class that would silently no-op. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(148, 163, 184, 0.16) 0%, rgba(148, 163, 184, 0) 70%)',
        }}
      />
    </>
  );
}

/** Fixed backdrop for the whole app: never interactive, never printed. */
export function ElegantBackdrop() {
  return (
    <div className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <PatternLayers />
    </div>
  );
}

interface DarkGradientBgProps {
  children?: React.ReactNode;
  className?: string;
}

export function DarkGradientBg({ children, className }: DarkGradientBgProps) {
  return (
    <div className={cn('relative min-h-screen w-full overflow-hidden bg-white dark:bg-black', className)}>
      <div className="absolute inset-0" aria-hidden="true">
        <PatternLayers />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default DarkGradientBg;
