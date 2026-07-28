/**
 * Join conditional class names.
 *
 * shadcn's `cn` wraps clsx + tailwind-merge. Nothing here relies on
 * tailwind-merge's conflict resolution, and this is an offline-first PWA, so
 * this keeps the bundle free of two extra dependencies. Swap in the real
 * clsx/tailwind-merge pair if more shadcn components land later.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
