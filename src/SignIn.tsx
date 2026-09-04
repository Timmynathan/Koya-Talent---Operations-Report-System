import { useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import opsrLogo from './assets/opsr-logo.png';
import './SignIn.css';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Deliberately generic regardless of the underlying cause (wrong
      // password, no such user, etc.) — never reveal whether an address
      // has an account.
      setError('Email or password is incorrect.');
      setSubmitting(false);
    }
    // On success, useSession's onAuthStateChange subscription picks up the
    // new session and App swaps this screen out — nothing else to do here.
  }

  return (
    <div className="signin-wrap">
      <form className="signin-card" onSubmit={handleSubmit}>
        <img src={opsrLogo} alt="Opsr" className="signin-logo" />
        <h1>Sign in</h1>
        <p className="signin-sub">Koya Talent — Operations Report</p>

        <label className="signin-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="signin-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="banner">{error}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
