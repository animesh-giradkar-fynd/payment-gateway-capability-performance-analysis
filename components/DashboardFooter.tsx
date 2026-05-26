/**
 * DashboardFooter — explicit methodology and provenance, rendered at the bottom of
 * the page. Closes the audit gap "no methodology page or glossary": every
 * definition a reviewer might challenge is one click away (or here, one scroll).
 *
 * Server component — pure markup, no client behaviour. Reads no data.
 */
export function DashboardFooter() {
  return (
    <footer className="dash-footer" role="contentinfo">
      <div className="dash-footer-grid">
        <section className="dash-footer-block">
          <h3>How the headline rates are computed</h3>
          <dl>
            <dt>KPI &ldquo;Success rate&rdquo;</dt>
            <dd>
              Successful transactions &divide; <strong>all</strong> transactions in the slice.
              The denominator includes Fynd&rsquo;s 2-hour cancels and uncategorised rows, so
              the rate reflects what the customer experienced end-to-end.
            </dd>
            <dt>Gateway leaderboard &ldquo;Success rate&rdquo;</dt>
            <dd>
              Successful &divide; (successful + gateway-declined). Excludes Fynd-side 2h cancels
              because those aren&rsquo;t the gateway&rsquo;s decision — keeps the gateway-vs-gateway
              comparison fair. Reads higher than the KPI card.
            </dd>
            <dt>Failure rate</dt>
            <dd>
              (All non-successful transactions) &divide; all transactions. Composed of three
              parts shown under the value: gateway-declined, Fynd 2h-timeout cancels, and
              uncategorised (status mapper didn&rsquo;t resolve).
            </dd>
            <dt>2h timeout / &ldquo;cancelled at Fynd&rdquo;</dt>
            <dd>
              Fynd&rsquo;s internal SLA: any transaction not reaching a terminal gateway status
              (success / failed / voided) within 2 hours is cancelled at Fynd&rsquo;s end. From
              the customer&rsquo;s point of view these are failures, so they count in the KPI
              failure rate.
            </dd>
          </dl>
        </section>

        <section className="dash-footer-block">
          <h3>Definitions &amp; scope</h3>
          <dl>
            <dt>Successful GMV</dt>
            <dd>Sum of <code>amount</code> over transactions with a successful unified status.</dd>
            <dt>Refund rate</dt>
            <dd>
              Refund value in the window &divide; successful GMV in the same window. Refunds
              may relate to sales from earlier periods — acceptable proxy for the top-line
              question; the precise cohort match lives in the Refund posture panel.
            </dd>
            <dt>Regional coverage</dt>
            <dd>
              Orders with a recognised Indian delivery state &divide; total orders in the slice.
              The unmapped share is international shipments + orders with non-canonical state
              strings. Shown in the Regional panel footer.
            </dd>
            <dt>Surface</dt>
            <dd>
              <code>dbe_orders.ordering_source</code>: <em>storefront</em> = Fynd-hosted brand
              site; <em>store_os_pos</em> = in-store POS terminal; <em>nexus</em> = headless / API
              checkout.
            </dd>
          </dl>
        </section>

        <section className="dash-footer-block">
          <h3>Data &amp; cadence</h3>
          <dl>
            <dt>Source</dt>
            <dd>
              BigQuery <code>fynd-jio-commerceml-prod.fynd_zenith_data</code>. Tables:{' '}
              <code>dbe_transaction</code>, <code>dbe_transaction_status</code>,{' '}
              <code>dbe_orders</code>, <code>dbe_shipments</code>,{' '}
              <code>dbe_aggregator_order_status_mapper</code>,{' '}
              <code>dbe_merchant_profile</code>, <code>dbe_aggregator</code>.
            </dd>
            <dt>Refresh</dt>
            <dd>
              Daily batch sync via Boltic. Live data lag is ~12–24h. The topbar shows the
              most-recent transaction timestamp.
            </dd>
            <dt>Exclusions</dt>
            <dd>
              Excludes test merchants, sandbox aggregators (Openapi, test/uat/dev/sandbox name
              patterns), <code>PAYMENTLINK</code>, refunds (for telemetry queries), and the
              Fynd internal handler (except on the Offline MOP panel, which is exclusively
              Fynd-managed).
            </dd>
            <dt>Capability matrix</dt>
            <dd>
              Curated in <code>data/capabilities.json</code>. Coverage % in the matrix footer
              shows how many cells have been explicitly reviewed; unreviewed cells default to
              &ldquo;Not offered&rdquo; and are honest about the unknown.
            </dd>
          </dl>
        </section>
      </div>

      <div className="dash-footer-meta">
        <span>Payments Capability · Fynd · Internal</span>
        <span>·</span>
        <span>India · v0</span>
      </div>
    </footer>
  );
}
