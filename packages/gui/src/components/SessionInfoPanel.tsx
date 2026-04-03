import type { SessionInfo } from '../types/session';

interface SessionInfoPanelProps {
  info: SessionInfo;
  side: 'left' | 'right';
}

function shortenPath(fullPath: string): string {
  // Show last 2-3 segments for readability
  const parts = fullPath.replace(/\\/g, '/').split('/');
  if (parts.length <= 3) return parts.join('/');
  return '.../' + parts.slice(-3).join('/');
}

export function SessionInfoPanel({ info, side }: SessionInfoPanelProps) {
  return (
    <div className={`info-panel info-panel--${side}`}>
      {/* CWD */}
      <div className="info-panel__section">
        <span className="info-panel__label">P R O J E C T</span>
        <span className="info-panel__cwd" title={info.cwd}>
          {info.cwd ? shortenPath(info.cwd) : '—'}
        </span>
      </div>

      <div className="info-panel__divider" />

      {/* Files Read */}
      <div className="info-panel__section">
        <span className="info-panel__label">
          F I L E S{info.filesRead.length > 0 ? ` (${info.filesRead.length})` : ''}
        </span>
        <div className="info-panel__list">
          {info.filesRead.length === 0 && (
            <span className="info-panel__empty">waiting...</span>
          )}
          {info.filesRead.map((f, i) => (
            <div key={i} className="info-panel__item" title={f}>
              {shortenPath(f)}
            </div>
          ))}
        </div>
      </div>

      <div className="info-panel__divider" />

      {/* Memory */}
      <div className="info-panel__section">
        <span className="info-panel__label">M E M O R Y</span>
        <div className="info-panel__list">
          {info.memoryItems.length === 0 && (
            <span className="info-panel__empty">—</span>
          )}
          {info.memoryItems.map((m, i) => (
            <div key={i} className="info-panel__item info-panel__item--mem">
              {m}
            </div>
          ))}
        </div>
      </div>

      <div className="info-panel__divider" />

      {/* MCPs */}
      <div className="info-panel__section">
        <span className="info-panel__label">M C P</span>
        <div className="info-panel__list">
          {info.activeMcps.length === 0 && (
            <span className="info-panel__empty">—</span>
          )}
          {info.activeMcps.map((s, i) => (
            <div key={i} className="info-panel__item info-panel__item--mcp">
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
