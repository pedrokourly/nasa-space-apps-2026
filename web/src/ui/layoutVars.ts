import { useEffect, useSyncExternalStore, type RefObject } from 'react';

/**
 * Layout helpers for small screens. Floating boxes are placed from the real size of the header and
 * of the EVA metrics bar (CSS variables on <html>), so nothing overlaps when those grow or wrap.
 */

/**
 * Writes the element's height to `--{name}-h` and its distance from the viewport bottom to its top
 * to `--{name}-top`. A ResizeObserver keeps them current; `deps` (e.g. an expanded flag) also
 * re-measure right away, so a collapsible updates the layout even before the observer fires.
 */
export function useLayoutVar(ref: RefObject<HTMLElement | null>, name: string, deps: unknown[] = []): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const write = () => {
      // Layout values, not getBoundingClientRect: an entry animation (translateY) must not shift
      // the measurement. For a bottom-anchored box, top-from-bottom = its CSS bottom + its height.
      const h = el.offsetHeight;
      const cs = getComputedStyle(el);
      const bottom = parseFloat(cs.bottom);
      const anchoredBottom = (cs.position === 'absolute' || cs.position === 'fixed') && cs.bottom !== 'auto' && Number.isFinite(bottom);
      const top = anchoredBottom ? bottom + h : window.innerHeight - el.getBoundingClientRect().top;
      root.setProperty(`--${name}-h`, `${Math.round(h)}px`);
      root.setProperty(`--${name}-top`, `${Math.round(top)}px`);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    window.addEventListener('resize', write);
    el.addEventListener('animationend', write);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', write);
      el.removeEventListener('animationend', write);
      root.removeProperty(`--${name}-h`);
      root.removeProperty(`--${name}-top`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists what changes the size
  }, [ref, name, ...deps]);
}

/** True while the media query matches (e.g. '(max-width: 600px)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phones: up to 600 px wide, or a phone held in landscape (up to 500 px tall). */
export const PHONE_QUERY = '(max-width: 600px), (max-height: 500px)';
/** Phones and small tablets: up to 768 px wide, or up to 500 px tall. */
export const NARROW_QUERY = '(max-width: 768px), (max-height: 500px)';
