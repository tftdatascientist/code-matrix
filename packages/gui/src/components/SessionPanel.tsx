import type { SessionMetrics, SessionState } from '../types/session';
import { ProgressBar } from './ProgressBar';

interface SessionPanelProps {
  metrics: SessionMetrics;
  state: SessionState;
}

function getThinkingColor(mode: string | null): string {
  if (!mode) return '';
  switch (mode.toLowerCase()) {
    case 'high': return 'metric-value--red';
    case 'medium': return 'metric-value--amber';
    default: return 'metric-value--green';
  }
}

function getCostColor(cost: number | null): string {
  if (cost === null) return '';
  if (cost >= 5) return 'metric-value--red';
  if (cost >= 1) return 'metric-value--amber';
  return '';
}

function getTimeColor(time: string | null): string {
  if (!time) return '';
  // Rough check: if contains "h" or number >= 30m, show amber
  if (time.includes('h') || /(\d{2,})m/.test(time)) return 'metric-value--amber';
  return '';
}

function getStatusIcon(status: SessionState['status']): string {
  switch (status) {
    case 'idle': return '○';
    case 'thinking': return '◉';
    case 'writing': return '●';
    case 'executing': return '⚡';
    case 'error': return '✕';
    case 'disconnected': return '◌';
  }
}

export function SessionPanel({ metrics, state }: SessionPanelProps) {
  return (
    <div className="session-panel">
      {/* Metrics section */}
      <div className="session-panel__section">
        <div className="metric">
          <span className="metric__label">M O D E L</span>
          <span className="metric__value">{metrics.model ?? '—'}</span>
        </div>

        <div className="metric">
          <span className="metric__label">C O N T E X T</span>
          <ProgressBar value={metrics.contextPercent} />
        </div>

        <div className="metric">
          <span className="metric__label">S E S S I O N</span>
          <ProgressBar value={metrics.sessionPercent} />
        </div>

        <div className="metric">
          <span className="metric__label">T I M E</span>
          <span className={`metric__value ${getTimeColor(metrics.sessionTime)}`}>
            {metrics.sessionTime ?? '—'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">T H I N K I N G</span>
          <span className={`metric__value ${getThinkingColor(metrics.thinkingMode)}`}>
            {metrics.thinkingMode ?? '—'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">C O S T</span>
          <span className={`metric__value ${getCostColor(metrics.cost)}`}>
            {metrics.cost !== null ? `$${metrics.cost.toFixed(2)}` : '—'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">W E E K L Y</span>
          <ProgressBar value={metrics.weeklyPercent} />
        </div>

        <div className="metric">
          <span className="metric__label">T O T A L</span>
          <span className="metric__value">
            {metrics.totalTokens !== null ? metrics.totalTokens.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      {/* Separator */}
      <div className="session-panel__divider" />

      {/* Permissions */}
      <div className="session-panel__section">
        <div className="metric">
          <span className="metric__label">P E R M I S S I O N</span>
          <span className={`metric__value metric__bypass ${metrics.bypassPermissions ? 'metric__bypass--on' : ''}`}>
            ▸▸ BYPASS: {metrics.bypassPermissions ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Separator */}
      <div className="session-panel__divider" />

      {/* Activity */}
      <div className="session-panel__section">
        <div className="metric">
          <span className="metric__label">A C T I V I T Y</span>
          <span className={`metric__value activity activity--${state.status}`}>
            <span className="activity__icon">{getStatusIcon(state.status)}</span>
            {' '}{state.status}
            {state.detail && <span className="activity__detail"> ({state.detail})</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
