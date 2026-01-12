'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface SystemSettings {
  lead_scoring: {
    website_visit: number;
    email_open: number;
    email_click: number;
    form_submit: number;
    consultation_scheduled: number;
    high_value_threshold: number;
  };
  assignment: {
    method: string;
    team_members: string[];
  };
  notifications: {
    email_enabled: boolean;
    hot_lead_threshold: number;
    daily_digest: boolean;
  };
  integrations: {
    google_ads_connected: boolean;
    google_analytics_connected: boolean;
    wordpress_connected: boolean;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings(data.settings || getDefaultSettings());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      setSettings(getDefaultSettings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function getDefaultSettings(): SystemSettings {
    return {
      lead_scoring: {
        website_visit: 5,
        email_open: 10,
        email_click: 15,
        form_submit: 25,
        consultation_scheduled: 40,
        high_value_threshold: 70,
      },
      assignment: {
        method: 'round_robin',
        team_members: ['chad', 'erik'],
      },
      notifications: {
        email_enabled: true,
        hot_lead_threshold: 70,
        daily_digest: true,
      },
      integrations: {
        google_ads_connected: false,
        google_analytics_connected: false,
        wordpress_connected: false,
      },
    };
  }

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSuccess(false);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateLeadScoring = (key: keyof SystemSettings['lead_scoring'], value: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      lead_scoring: { ...settings.lead_scoring, [key]: value },
    });
  };

  const updateNotifications = (key: keyof SystemSettings['notifications'], value: boolean | number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    });
  };

  const updateAssignment = (key: keyof SystemSettings['assignment'], value: string | string[]) => {
    if (!settings) return;
    setSettings({
      ...settings,
      assignment: { ...settings.assignment, [key]: value },
    });
  };

  if (error && !loading && !settings) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Button onClick={fetchSettings}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your marketing automation system
          </p>
        </div>
        <div className="flex items-center gap-2">
          {success && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Saved successfully</span>
            </div>
          )}
          <Button variant="outline" onClick={fetchSettings} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : settings ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lead Scoring */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Scoring</CardTitle>
              <CardDescription>
                Configure points awarded for different lead activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website_visit">Website Visit</Label>
                  <Input
                    id="website_visit"
                    type="number"
                    value={settings.lead_scoring.website_visit}
                    onChange={(e) => updateLeadScoring('website_visit', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_open">Email Open</Label>
                  <Input
                    id="email_open"
                    type="number"
                    value={settings.lead_scoring.email_open}
                    onChange={(e) => updateLeadScoring('email_open', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_click">Email Click</Label>
                  <Input
                    id="email_click"
                    type="number"
                    value={settings.lead_scoring.email_click}
                    onChange={(e) => updateLeadScoring('email_click', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form_submit">Form Submit</Label>
                  <Input
                    id="form_submit"
                    type="number"
                    value={settings.lead_scoring.form_submit}
                    onChange={(e) => updateLeadScoring('form_submit', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consultation_scheduled">Consultation Scheduled</Label>
                  <Input
                    id="consultation_scheduled"
                    type="number"
                    value={settings.lead_scoring.consultation_scheduled}
                    onChange={(e) => updateLeadScoring('consultation_scheduled', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="high_value_threshold">Hot Lead Threshold</Label>
                  <Input
                    id="high_value_threshold"
                    type="number"
                    value={settings.lead_scoring.high_value_threshold}
                    onChange={(e) => updateLeadScoring('high_value_threshold', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Assignment</CardTitle>
              <CardDescription>
                Configure how new leads are assigned to team members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Assignment Method</Label>
                <Select
                  value={settings.assignment.method}
                  onValueChange={(value) => updateAssignment('method', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                    <SelectItem value="workload_based">Workload Based</SelectItem>
                    <SelectItem value="manual">Manual Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team Members</Label>
                <div className="text-sm text-muted-foreground">
                  {settings.assignment.team_members.map((member) => (
                    <span
                      key={member}
                      className="inline-block px-2 py-1 mr-2 mb-2 bg-gray-100 rounded capitalize"
                    >
                      {member}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure email and alert preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email alerts for important events
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.email_enabled}
                  onCheckedChange={(checked) => updateNotifications('email_enabled', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a daily summary email
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.daily_digest}
                  onCheckedChange={(checked) => updateNotifications('daily_digest', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hot_lead_threshold">Hot Lead Alert Threshold</Label>
                <Input
                  id="hot_lead_threshold"
                  type="number"
                  value={settings.notifications.hot_lead_threshold}
                  onChange={(e) => updateNotifications('hot_lead_threshold', parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground">
                  Get notified when a lead score exceeds this value
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect external services to your marketing system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Google Ads</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.integrations.google_ads_connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  {settings.integrations.google_ads_connected ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Google Analytics</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.integrations.google_analytics_connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  {settings.integrations.google_analytics_connected ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">WordPress</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.integrations.wordpress_connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  {settings.integrations.wordpress_connected ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
