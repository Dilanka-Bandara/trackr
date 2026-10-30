'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileSchema, changePasswordSchema, type User } from '@trackr/shared';
import { useUser } from '@/hooks/use-trackr';
import { api, json } from '@/lib/api';
import { Button } from './ui/button';

function ProfileForm({ user }: { user: User }) {
  const client = useQueryClient();
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState('');
  const update = useMutation({
    mutationFn: (value: string) => {
      const input = profileSchema.safeParse({ name: value });
      if (!input.success) throw new Error('Enter a name between 2 and 80 characters.');
      return api<User>('/auth/profile', json('PATCH', input.data));
    },
    onSuccess: (saved) => {
      client.setQueryData(['me'], saved);
      setName(saved.name);
      setMessage('Your profile has been saved.');
    },
  });
  return (
    <section className="panel account-card" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Your profile</h2>
      <p>Choose the name shown in your workspace.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setMessage('');
          update.mutate(name);
        }}
      >
        <label htmlFor="profile-name">Full name</label>
        <input
          id="profile-name"
          autoComplete="name"
          value={name}
          maxLength={80}
          required
          onChange={(event) => {
            setName(event.target.value);
            setMessage('');
          }}
        />
        <label htmlFor="profile-email">Email address</label>
        <input
          id="profile-email"
          type="email"
          value={user.email}
          readOnly
          aria-describedby="email-help"
        />
        <small id="email-help">Your sign-in email cannot be changed here.</small>
        {update.error && (
          <p role="alert" className="form-error">
            {update.error.message}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const change = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmation) throw new Error('New passwords do not match.');
      const input = changePasswordSchema.safeParse({ currentPassword, newPassword });
      if (!input.success) throw new Error(input.error.issues[0]?.message || 'Check your password.');
      return api('/auth/password', json('POST', input.data));
    },
    onSuccess: () => {
      window.location.assign('/login?passwordChanged=1');
    },
  });
  return (
    <section className="panel account-card" aria-labelledby="password-heading">
      <h2 id="password-heading">Change password</h2>
      <p>Use 8–128 characters. You will need to sign in again after saving.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate();
        }}
      >
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <small>
          Existing sessions cannot refresh after this change. Other devices may stay signed in for
          up to 15 minutes. Google-only accounts manage passwords through Google.
        </small>
        {change.error && (
          <p role="alert" className="form-error">
            {change.error.message}
          </p>
        )}
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Changing password…' : 'Change password'}
        </Button>
      </form>
    </section>
  );
}

export function AccountSettings() {
  const user = useUser();
  if (user.isPending) return <p role="status">Loading your account…</p>;
  if (!user.data)
    return <p role="alert">Could not load your account. Refresh the page to retry.</p>;
  return (
    <div className="account-grid">
      <ProfileForm key={user.data.id} user={user.data} />
      <PasswordForm />
    </div>
  );
}
