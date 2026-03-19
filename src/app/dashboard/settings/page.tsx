'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SettingsData {
  user: { name: string | null; email: string | null };
  client: {
    id: string;
    businessName: string;
    websiteUrl: string;
    city: string;
    state: string | null;
    phone: string | null;
    address: string | null;
    category: string | null;
    services: string[];
    hours: string | null;
    googleBusinessUrl: string | null;
  } | null;
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

  // Business form
  const [businessName, setBusinessName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [businessMessage, setBusinessMessage] = useState('');
  const [businessError, setBusinessError] = useState('');
  const [businessLoading, setBusinessLoading] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data as SettingsData;
        setData(d);
        setName(d.user.name ?? '');
        if (d.client) {
          setBusinessName(d.client.businessName);
          setWebsiteUrl(d.client.websiteUrl);
          setCity(d.client.city);
          setState(d.client.state ?? '');
          setPhone(d.client.phone ?? '');
          setCategory(d.client.category ?? '');
        }
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

  async function handleBusinessSubmit(e: FormEvent) {
    e.preventDefault();
    setBusinessMessage('');
    setBusinessError('');
    setBusinessLoading(true);

    try {
      const res = await fetch('/api/dashboard/client', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          websiteUrl,
          city,
          state: state || undefined,
          phone: phone || undefined,
          category: category || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setBusinessError(json.error || 'Failed to update.');
        return;
      }

      setBusinessMessage('Business details updated.');
    } catch {
      setBusinessError('Something went wrong.');
    } finally {
      setBusinessLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-6">
        <div className="h-8 w-32 rounded bg-gray-200" />
        <div className="h-64 rounded-lg bg-gray-200" />
        <div className="h-64 rounded-lg bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

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

      {/* Business Settings */}
      {data?.client && (
        <Card className="mt-6" title="Business Details">
          <form onSubmit={handleBusinessSubmit} className="space-y-4">
            <Input
              label="Business Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              disabled={businessLoading}
            />
            <Input
              label="Website"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={businessLoading}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={businessLoading}
              />
              <Input
                label="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={businessLoading}
              />
            </div>
            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={businessLoading}
            />
            <Input
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={businessLoading}
            />
            {businessError && <p className="text-sm text-red-600">{businessError}</p>}
            {businessMessage && <p className="text-sm text-green-600">{businessMessage}</p>}
            <Button type="submit" isLoading={businessLoading}>
              Save Business Details
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
