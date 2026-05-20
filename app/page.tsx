import { redirect } from 'next/navigation';

/**
 * Root path always redirects to /dashboard. The middleware (HTTP Basic Auth) has
 * already authenticated the request by the time we get here — there's nothing for
 * this page to do except forward.
 */
export default function Home() {
  redirect('/dashboard');
}
