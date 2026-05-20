type PanelProps = {
  title: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
};

/**
 * Panel — wraps a metric card or chart with a consistent title + state surface.
 * Will be replaced/composed with Novus primitives in M2; same prop shape so the swap
 * is non-breaking for consumers.
 */
export function Panel({ title, loading, error, children }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      <div className="panel-body">
        {loading ? (
          <div className="panel-loading">Loading…</div>
        ) : error ? (
          <div className="panel-error">Couldn&rsquo;t load. {error}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
