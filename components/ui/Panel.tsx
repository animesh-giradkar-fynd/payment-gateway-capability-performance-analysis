type PanelProps = {
  title: string;
  /** Optional one-line explainer shown under the title — for panels a new viewer
   *  can't interpret from the title alone. */
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
};

/**
 * Panel — wraps a metric card or chart with a consistent title + state surface.
 * Will be replaced/composed with Novus primitives in M2; same prop shape so the swap
 * is non-breaking for consumers.
 */
export function Panel({ title, subtitle, loading, error, children }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      {subtitle ? <div className="panel-subtitle">{subtitle}</div> : null}
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
