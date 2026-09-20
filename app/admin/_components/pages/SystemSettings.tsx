'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import apiClient from '@/lib/api/httpClient';

type AssignmentPriority = 'routine' | 'urgent' | 'emergency';
interface AssignmentExpirySetting { priority: AssignmentPriority; expiryHours: number; isActive: boolean; }

const PRIORITY_LABELS: Record<AssignmentPriority, string> = { routine: 'Routine', urgent: 'Urgent', emergency: 'Emergency' };

export function SystemSettings() {
  const [settings, setSettings] = useState<AssignmentExpirySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/admin/assignment-expiry');
      if (!response.data.success) throw new Error(response.data.message || 'Unable to load settings');
      setSettings(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to load assignment expiry settings');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadSettings(); }, []);

  const updateSetting = (priority: AssignmentPriority, updates: Partial<AssignmentExpirySetting>) => {
    setSettings((current) => current.map((setting) => setting.priority === priority ? { ...setting, ...updates } : setting));
  };

  const saveSettings = async () => {
    if (settings.some((setting) => !Number.isInteger(setting.expiryHours) || setting.expiryHours < 1)) {
      toast.error('Expiry hours must be a whole number greater than zero.');
      return;
    }
    try {
      setSaving(true);
      const response = await apiClient.put('/api/admin/assignment-expiry', settings);
      if (!response.data.success) throw new Error(response.data.message || 'Unable to save settings');
      setSettings(response.data.data || settings);
      toast.success('Assignment expiry settings saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to save assignment expiry settings');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <PageHeader title="Assignment Settings" description="Configure response windows for hospital and home-visit assignments." actions={(
        <Button onClick={saveSettings} disabled={loading || saving || settings.length === 0} className="bg-navy-600 hover:bg-navy-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      )} />
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Doctor response windows</CardTitle>
              <CardDescription className="max-w-3xl leading-6">Set how long a doctor has to respond to hospital and home-visit assignments. These values apply to new assignments.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {settings.map((setting) => (
                <div key={setting.priority} className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <div><h3 className="font-semibold text-slate-900">{PRIORITY_LABELS[setting.priority]}</h3><p className="mt-1 text-sm text-slate-500">Doctor response window</p></div>
                  <div className="space-y-2"><Label htmlFor={`${setting.priority}-expiry`}>Expiry hours</Label><Input id={`${setting.priority}-expiry`} type="number" min={1} value={setting.expiryHours} onChange={(event) => updateSetting(setting.priority, { expiryHours: Number(event.target.value) })} /></div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <Label htmlFor={`${setting.priority}-active`}>Accept assignments</Label>
                      <p className={`mt-1 text-xs font-medium ${setting.isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {setting.isActive ? 'Active' : 'Disabled'}
                      </p>
                    </div>
                    <Switch id={`${setting.priority}-active`} checked={setting.isActive} onCheckedChange={(isActive) => updateSetting(setting.priority, { isActive })} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <p className="mt-4 text-sm leading-6 text-slate-500">Home-visit availability, free trials, payment timing, and early completion are managed under Home Visit Settings.</p>
      </main>
    </div>
  );
}
