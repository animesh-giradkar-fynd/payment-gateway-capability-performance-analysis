import 'server-only';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * BigQuery singleton per D008 — two-phase auth.
 *
 * Local dev: GCP_SERVICE_ACCOUNT_JSON is empty; BigQuery falls back to Application
 *   Default Credentials, which `gcloud auth application-default login` provides.
 *
 * Vercel / prod: GCP_SERVICE_ACCOUNT_JSON contains the service account JSON inline
 *   (single-line, escaped). The client uses that explicitly. ADC isn't available in
 *   Vercel's serverless runtime.
 *
 * The library handles both paths transparently — no conditional logic at call sites.
 */
let client: BigQuery | null = null;

export function getBQ(): BigQuery {
  if (client) return client;

  const json = process.env.GCP_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.BQ_PROJECT ?? 'fynd-jio-commerceml-prod';

  if (json && json.trim().length > 0) {
    try {
      const credentials = JSON.parse(json);
      client = new BigQuery({
        credentials,
        projectId: credentials.project_id ?? projectId,
      });
    } catch (err) {
      throw new Error(
        `Failed to parse GCP_SERVICE_ACCOUNT_JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    // ADC fallback — gcloud login on local
    client = new BigQuery({ projectId });
  }

  return client;
}
