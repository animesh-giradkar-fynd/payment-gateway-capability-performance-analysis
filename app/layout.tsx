import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  // Browser tab + window title. Static is fine — single-page dashboard.
  title: 'Payments Capability · Fynd',
  description:
    'Internal Fynd Payments dashboard — ecosystem health, gateway leaderboard, MOP mix, refund posture, and the capability matrix. India · daily-refresh BigQuery.',
  // Internal tool — never index. `noindex,nofollow` is the strongest hint to crawlers.
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  // Browser-tab icon. Reuses the existing brand asset in /public.
  icons: {
    icon: '/fynd-icon.png',
    apple: '/fynd-icon.png',
  },
  // OG / Twitter sharing — Slack / Teams previews look like a real product, not a
  // bare URL. Title + description + a small icon thumbnail.
  openGraph: {
    title: 'Payments Capability · Fynd',
    description:
      'Internal Fynd Payments dashboard — ecosystem health, gateway leaderboard, MOP mix, refund posture.',
    type: 'website',
    siteName: 'Fynd',
    images: [{ url: '/fynd-icon.png', width: 256, height: 256, alt: 'Fynd' }],
  },
  twitter: {
    card: 'summary',
    title: 'Payments Capability · Fynd',
    description: 'Internal Fynd Payments dashboard.',
    images: ['/fynd-icon.png'],
  },
  applicationName: 'Payments Capability',
  authors: [{ name: 'Fynd Payments' }],
  // Don't let mobile browsers auto-zoom on form focus; the filter chips have
  // small inputs that would otherwise jitter the viewport on tap.
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
