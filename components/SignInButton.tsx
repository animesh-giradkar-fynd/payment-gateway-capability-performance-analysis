'use client';
import Image from 'next/image';
import { signIn, signOut } from 'next-auth/react';

export function SignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
      className="signin-button"
    >
      <Image
        src="/google-icon.svg"
        alt=""
        width={18}
        height={18}
        aria-hidden
      />
      <span>Sign in with Google</span>
    </button>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="signout-button"
    >
      Sign out
    </button>
  );
}
