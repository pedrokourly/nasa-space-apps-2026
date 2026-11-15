/** Joins class names, skipping empty ones (shadcn's `cn`, without tailwind-merge). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
