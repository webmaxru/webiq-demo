import type { TelemetryInfo } from '../types/meta';

interface RunBarProps {
  loading: boolean;
  disabled: boolean;
  telemetry?: TelemetryInfo;
  onRun: () => void;
  onCancel: () => void;
}

export function RunBar({ loading, disabled, telemetry, onRun, onCancel }: RunBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-primary min-w-36" disabled={disabled || loading} onClick={onRun} type="button">
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Running…
          </span>
        ) : (
          'Run request'
        )}
      </button>
      {loading ? (
        <button className="btn-secondary" onClick={onCancel} type="button">
          Cancel
        </button>
      ) : null}
      {telemetry ? (
        <span className="badge bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/40">{telemetry.elapsedMs} ms</span>
      ) : null}
    </div>
  );
}
