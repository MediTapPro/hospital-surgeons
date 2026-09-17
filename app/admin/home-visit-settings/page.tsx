'use client';

import { useEffect, useState } from 'react';
import { CalendarHeart, Gift, Loader2, Save, ShieldCheck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../_components/PageHeader';
import { Button } from '../_components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../_components/ui/card';
import { Input } from '../_components/ui/input';
import { Label } from '../_components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_components/ui/select';
import apiClient from '@/lib/api/httpClient';
import {
  HOME_VISIT_PAYMENT_TIMINGS,
  type HomeVisitPaymentTiming,
} from '@/lib/utils/constants';

interface HomeVisitSettings {
  homeVisitEnabled: boolean;
  freeTrialEnabled: boolean;
  freeTrialVisitLimit: number;
  freeTrialActiveBookingLimit: number;
  paidPaymentTiming: HomeVisitPaymentTiming;
}

const DEFAULT_SETTINGS: HomeVisitSettings = {
  homeVisitEnabled: true,
  freeTrialEnabled: true,
  freeTrialVisitLimit: 1,
  freeTrialActiveBookingLimit: 1,
  paidPaymentTiming: 'pay_after_completion',
};

function SettingsToggle({
  checked,
  description,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-semibold text-slate-900">{label}</Label>
        <p className="text-sm leading-5 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={`relative h-10 w-24 shrink-0 rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
          checked
            ? 'border-teal-600 bg-teal-600 text-white'
            : 'border-slate-300 bg-slate-100 text-slate-600'
        }`}
        >
        <span
          className={`absolute top-1.5 left-1.5 size-6 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-14' : 'translate-x-0'
          }`}
        />
        <span className={checked ? 'absolute left-3 top-3' : 'absolute right-3 top-3'}>{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

export default function HomeVisitSettingsPage() {
  const [settings, setSettings] = useState<HomeVisitSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiClient.get('/api/admin/home-visit-settings');
        if (response.data.success && response.data.data) {
          const data = response.data.data;
          setSettings({
            homeVisitEnabled: data.homeVisitEnabled,
            freeTrialEnabled: data.freeTrialEnabled,
            freeTrialVisitLimit: data.freeTrialVisitLimit,
            freeTrialActiveBookingLimit: data.freeTrialActiveBookingLimit,
            paidPaymentTiming: data.paidPaymentTiming,
          });
          return;
        }

        toast.error(response.data.message || 'Unable to load home visit settings.');
      } catch (error) {
        console.error('Unable to load home visit settings:', error);
        toast.error('Unable to load home visit settings.');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = (updates: Partial<HomeVisitSettings>) => {
    setSettings((current) => ({ ...current, ...updates }));
  };

  const saveSettings = async () => {
    if (!Number.isInteger(settings.freeTrialVisitLimit) || settings.freeTrialVisitLimit < 0) {
      toast.error('Free trial visit limit must be zero or more.');
      return;
    }

    if (!Number.isInteger(settings.freeTrialActiveBookingLimit) || settings.freeTrialActiveBookingLimit < 1) {
      toast.error('Active free-trial booking limit must be at least one.');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.put('/api/admin/home-visit-settings', settings);
      if (response.data.success) {
        toast.success('Home visit settings saved.');
        return;
      }

      toast.error(response.data.message || 'Unable to save home visit settings.');
    } catch (error) {
      console.error('Unable to save home visit settings:', error);
      toast.error('Unable to save home visit settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <PageHeader title="Home Visit Settings" description="Control availability, free trials, and future payment timing." />
        <div className="flex min-h-[360px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-teal-600" aria-label="Loading home visit settings" />
        </div>
      </main>
    );
  }

  const selectedPaymentTiming = HOME_VISIT_PAYMENT_TIMINGS.find(
    (timing) => timing.value === settings.paidPaymentTiming
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <PageHeader
        title="Home Visit Settings"
        description="Control home-visit availability, free trials, and the payment policy for future paid bookings."
        actions={
          <Button onClick={saveSettings} disabled={saving} className="bg-teal-600 text-white hover:bg-teal-700">
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save settings
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row gap-3 space-y-0">
            <div className="rounded-lg bg-teal-50 p-2.5 text-teal-700"><CalendarHeart className="size-5" /></div>
            <div>
              <CardTitle className="text-lg text-slate-900">Availability</CardTitle>
              <CardDescription>Turn patient-initiated home visits on or off across the platform.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SettingsToggle
              id="home-visit-enabled"
              label="Enable home visit bookings"
              description="When disabled, patients cannot create new home-visit bookings. Existing bookings are unaffected."
              checked={settings.homeVisitEnabled}
              onCheckedChange={(homeVisitEnabled) => updateSettings({ homeVisitEnabled })}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row gap-3 space-y-0">
            <div className="rounded-lg bg-amber-50 p-2.5 text-amber-700"><Gift className="size-5" /></div>
            <div>
              <CardTitle className="text-lg text-slate-900">Free trial</CardTitle>
              <CardDescription>Offer eligible patients a limited number of complimentary home visits for testing.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingsToggle
              id="free-trial-enabled"
              label="Enable free trial"
              description="Eligible patients can book free visits until they reach the configured limit."
              checked={settings.freeTrialEnabled}
              onCheckedChange={(freeTrialEnabled) => updateSettings({ freeTrialEnabled })}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trial-visit-limit">Free visits per patient</Label>
                <Input
                  id="trial-visit-limit"
                  type="number"
                  min="0"
                  step="1"
                  disabled={!settings.freeTrialEnabled}
                  value={settings.freeTrialVisitLimit}
                  onChange={(event) => updateSettings({ freeTrialVisitLimit: Number(event.target.value) })}
                />
                <p className="text-xs text-slate-500">Set to zero to keep the trial feature enabled without granting any visits.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="active-trial-limit">Active free-trial bookings</Label>
                <Input
                  id="active-trial-limit"
                  type="number"
                  min="1"
                  step="1"
                  disabled={!settings.freeTrialEnabled}
                  value={settings.freeTrialActiveBookingLimit}
                  onChange={(event) => updateSettings({ freeTrialActiveBookingLimit: Number(event.target.value) })}
                />
                <p className="text-xs text-slate-500">Limits pending or accepted complimentary bookings per patient.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row gap-3 space-y-0">
            <div className="rounded-lg bg-violet-50 p-2.5 text-violet-700"><WalletCards className="size-5" /></div>
            <div>
              <CardTitle className="text-lg text-slate-900">Paid booking policy</CardTitle>
              <CardDescription>Used when free trials are disabled or a patient has used their trial visits.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="paid-payment-timing">When should a patient pay?</Label>
            <Select
              value={settings.paidPaymentTiming}
              onValueChange={(paidPaymentTiming: HomeVisitPaymentTiming) => updateSettings({ paidPaymentTiming })}
            >
              <SelectTrigger id="paid-payment-timing" className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOME_VISIT_PAYMENT_TIMINGS.map((timing) => (
                  <SelectItem key={timing.value} value={timing.value}>{timing.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">{selectedPaymentTiming?.description}</p>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-700" />
          <p>Changes apply to new bookings only. Every booking stores its payment mode when it is created, so existing visits keep their original rule.</p>
        </div>
      </div>
    </main>
  );
}
