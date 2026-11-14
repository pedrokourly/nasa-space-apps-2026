import { useAppStore } from '../state/store';
import './RouteSummary.css';

/** Indicador mínimo de estado e resumo da rota (o painel completo é da frente UI). */
export default function RouteSummary() {
  const status = useAppStore((s) => s.routeStatus);
  const route = useAppStore((s) => s.route);
  const error = useAppStore((s) => s.routeError);

  let text: string | null = null;
  let kind = 'info';
  if (status === 'computing') text = 'Calculando rota…';
  else if (status === 'error') {
    kind = 'error';
    text = error === 'Sem caminho possível entre os pontos' ? error : `Erro ao calcular rota: ${error ?? 'desconhecido'}`;
  } else if (status === 'ready' && route) {
    const p = route.properties;
    const km = (p.dist_m / 1000).toFixed(1).replace('.', ',');
    const min = Math.round(p.tempo_s / 60);
    const o2 = p.o2_kg.toFixed(2).replace('.', ',');
    text = `${km} km · ${min} min · ${o2} kg O₂${p.mock ? ' (mock)' : ''}`;
  }
  if (!text) return null;

  return (
    <div className={`route-summary route-summary--${kind}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}
