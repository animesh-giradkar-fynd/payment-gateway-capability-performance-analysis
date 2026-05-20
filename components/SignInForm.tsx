'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function SignInForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('Invalid username or password.');
      } else if (result?.ok) {
        window.location.href = '/dashboard';
      } else {
        setError('Sign-in failed. Try again.');
      }
    } catch {
      setError('Sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="signin-form" autoComplete="on">
      <label className="signin-field">
        <span className="signin-field-label">Username</span>
        <input
          type="text"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label className="signin-field">
        <span className="signin-field-label">Password</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button
        type="submit"
        className="signin-submit"
        disabled={loading || !username || !password}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      {error ? <p className="signin-error">{error}</p> : null}
    </form>
  );
}
