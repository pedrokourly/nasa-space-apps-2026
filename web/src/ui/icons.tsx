/**
 * Inline SVG icons on one 24 × 24 grid, stroke-only, so every icon has the same size, weight and
 * optical center (UI review, decision 5: keep inline SVGs, no icon dependency). Size and stroke come
 * from the parent (`.ui-btn svg` in kit.css).
 */
const base = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;

export function InfoIcon() {
  return <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5h.01" /></svg>;
}

export function LayersIcon() {
  return <svg {...base}><path d="M3 19c3-1 4-6 8-6s5 4 10 2" /><path d="M4 14c3-1 4-5 8-5 3 0 4 2 7 1" /><path d="M6 8c2-.7 3-3 6-3 2 0 3 1 5 1" /></svg>;
}

export function ThermometerIcon() {
  return <svg {...base}><path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z" /><path d="M11 8v9" /><circle cx="11" cy="18.5" r="1.5" /></svg>;
}

export function SlopeIcon() {
  return <svg {...base}><path d="M3 20 10 7l4 7 3-5 4 11H3Z" /><path d="m7 17 4-3 3 2 4-5" /></svg>;
}

export function MaximizeIcon() {
  return <svg {...base}><path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" /></svg>;
}

export function NavigationIcon() {
  return <svg {...base}><path d="M12 2 4 21l8-4 8 4L12 2Z" /></svg>;
}

export function RouteIcon() {
  return <svg {...base}><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" /></svg>;
}

export function ListIcon() {
  return <svg {...base}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></svg>;
}

export function SortIcon() {
  return <svg {...base}><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>;
}
