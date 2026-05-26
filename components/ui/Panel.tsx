type SkeletonShape = 'metric' | 'chart' | 'table' | 'list';

type PanelProps = {
  title: string;
  /** Optional one-line explainer shown under the title — for panels a new viewer
   *  can't interpret from the title alone. */
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  /** Drives the loading-skeleton shape so the placeholder matches the panel's
   *  eventual content. Default = 'chart' (≈280px tall block). Use 'metric' for
   *  small KPI cards, 'table' for the surface table, 'list' for short item lists. */
  skeletonShape?: SkeletonShape;
  children: React.ReactNode;
};

/**
 * Panel — wraps a metric card or chart with a consistent title + state surface.
 *
 * Loading state now renders a shaped skeleton placeholder (not "Loading…" text) so
 * the page silhouette is stable from first paint through data arrival — viewers
 * on slow connections don't see a wall of text that pops to charts.
 *
 * Error state shows the underlying message in a contained card with a reload hint
 * so the rest of the dashboard is unaffected.
 */
export function Panel({ title, subtitle, loading, error, skeletonShape = 'chart', children }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      {subtitle ? <div className="panel-subtitle">{subtitle}</div> : null}
      <div className="panel-body">
        {loading ? (
          <PanelSkeleton shape={skeletonShape} />
        ) : error ? (
          <div className="panel-error" role="alert">
            <strong>Couldn&rsquo;t load.</strong>{' '}
            <span className="panel-error-msg">{error}</span>
            <span className="panel-error-hint">Retry the page; if it persists, ping the dashboard owner.</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function PanelSkeleton({ shape }: { shape: SkeletonShape }) {
  if (shape === 'metric') {
    return (
      <div className="skeleton-block" aria-busy="true" aria-label="Loading">
        <div className="skel-line skel-line-lg" />
        <div className="skel-line skel-line-md" />
        <div className="skel-line skel-line-sm" />
      </div>
    );
  }
  if (shape === 'table') {
    return (
      <div className="skeleton-block" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3].map((i) => (
          <div className="skel-row" key={i}>
            <div className="skel-cell skel-cell-name" />
            <div className="skel-cell" />
            <div className="skel-cell" />
            <div className="skel-cell" />
          </div>
        ))}
      </div>
    );
  }
  if (shape === 'list') {
    return (
      <div className="skeleton-block" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="skel-line skel-line-md" key={i} />
        ))}
      </div>
    );
  }
  // default = chart-shaped block
  return (
    <div className="skeleton-block skel-chart" aria-busy="true" aria-label="Loading" />
  );
}
