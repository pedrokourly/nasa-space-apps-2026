import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import './CopyRouteLink.css';

type Feedback = 'idle' | 'copied' | 'failed';

/** Copies the current page URL (which carries the route hash). Shown only when there are waypoints. */
export default function CopyRouteLink() {
  const hasRoute = useAppStore((s) => s.waypoints.length > 0);
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!hasRoute) return null;

  const copy = async () => {
    let result: Feedback = 'copied';
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      result = 'failed';
    }
    setFeedback(result);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFeedback('idle'), 2000);
  };

  return (
    <div className="copy-route-link">
      <button type="button" onClick={() => void copy()}>
        Copy link
      </button>
      <span className="copy-route-link__status" role="status" aria-live="polite">
        {feedback === 'copied' ? 'Link copied' : feedback === 'failed' ? 'Copy failed' : ''}
      </span>
    </div>
  );
}
