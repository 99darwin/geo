'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SettingsData {
  user: { name: string | null; email: string | null };
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Account form
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data as SettingsData;
        setData(d);
        setName(d.user.name ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAccountSubmit(e: FormEvent) {
    e.preventDefault();
    setAccountMessage('');
    setAccountError('');
    setAccountLoading(true);

    try {
      const body: Record<string, string> = {};
      if (name !== data?.user.name) body.name = name;
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      if (Object.keys(body).length === 0) {
        setAccountMessage('No changes to save.');
        return;
      }

      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setAccountError(json.error || 'Failed to update.');
        return;
      }

      setAccountMessage('Account updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setAccountError('Something went wrong.');
    } finally {
      setAccountLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-6">
        <div className="h-8 w-32 rounded bg-gray-200" />
        <div className="h-64 rounded-lg bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-gray-500">
        Manage your account. To edit business details, go to the business dashboard.
      </p>

      {/* Account Settings */}
      <Card className="mt-6" title="Account">
        <form onSubmit={handleAccountSubmit} className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={accountLoading}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <p className="text-sm text-gray-500">{data?.user.email}</p>
          </div>
          <hr className="border-gray-100" />
          <p className="text-sm font-medium text-gray-700">Change Password</p>
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={accountLoading}
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={accountLoading}
            autoComplete="new-password"
          />
          {accountError && <p className="text-sm text-red-600">{accountError}</p>}
          {accountMessage && <p className="text-sm text-green-600">{accountMessage}</p>}
          <Button type="submit" isLoading={accountLoading}>
            Save Account
          </Button>
        </form>
      </Card>
    </div>
  );
}
