/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Route Handlers reading from BQ should not be cached at the framework layer;
    // we cache at the data layer instead (Next Data Cache via fetch tags, applied per route).
    serverComponentsExternalPackages: ['@google-cloud/bigquery'],
  },
};

export default nextConfig;
