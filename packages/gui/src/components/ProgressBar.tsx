interface ProgressBarProps {
  value: number | null; // 0-100
  blocks?: number;
}

function getThresholdClass(value: number): string {
  if (value >= 85) return 'progress-bar--red';
  if (value >= 60) return 'progress-bar--amber';
  return 'progress-bar--green';
}

export function ProgressBar({ value, blocks = 10 }: ProgressBarProps) {
  if (value === null) {
    return <span className="progress-bar progress-bar--empty">{'░'.repeat(blocks)} —</span>;
  }

  const filled = Math.round((value / 100) * blocks);
  const empty = blocks - filled;

  return (
    <span className={`progress-bar ${getThresholdClass(value)}`}>
      {'█'.repeat(filled)}{'░'.repeat(empty)}{' '}
      <span className="progress-bar__value">{value.toFixed(1)}%</span>
    </span>
  );
}
