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
  allowEarlyAssignmentCompletion: boolean;
}

const DEFAULT_SETTINGS: HomeVisitSettings = {
  homeVisitEnabled: true,
  freeTrialEnabled: true,
  freeTrialVisitLimit: 1,
  freeTrialActiveBookingLimit: 1,
  paidPaymentTiming: 'pay_after_completion',
  allowEarlyAssignmentCompletion: false,
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
    <div className="flex items-center justify-between gap-6 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="block text-sm font-semibold text-slate-900">{label}</Label>
        <p className="max-w-2xl text-sm leading-5 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
          checked
            ? 'border-teal-600 bg-teal-600 text-white'
            : 'border-slate-300 bg-slate-100 text-slate-600'
        }`}
        >
        <span
          className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`hidden w-12 text-right text-xs font-semibold sm:block ${checked ? 'text-teal-700' : 'text-slate-500'}`}>{checked ? 'On' : 'Off'}</span>
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
            allowEarlyAssignmentCompletion: data.allowEarlyAssignmentCompletion,
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

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-teal-600 p-3 text-white shadow-sm"><CalendarHeart className="size-6" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Platform controls</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Home-visit booking rules</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">These settings control new bookings. Existing assignments keep the rules captured when they were created.</p>
            </div>
          </div>
        </div>
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
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <Label htmlFor="trial-visit-limit" className="text-sm font-semibold text-slate-900">Free visits per patient</Label>
                <Input
                  id="trial-visit-limit"
                  type="number"
                  min="0"
                  step="1"
                  disabled={!settings.freeTrialEnabled}
                  value={settings.freeTrialVisitLimit}
                  className="mt-2 h-11 border-slate-200 bg-white focus-visible:ring-teal-500"
                  onChange={(event) => updateSettings({ freeTrialVisitLimit: Number(event.target.value) })}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">Use <span className="font-semibold text-slate-700">0</span> to keep the trial visible but grant no complimentary visits.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <Label htmlFor="active-trial-limit" className="text-sm font-semibold text-slate-900">Active free-trial bookings</Label>
                <Input
                  id="active-trial-limit"
                  type="number"
                  min="1"
                  step="1"
                  disabled={!settings.freeTrialEnabled}
                  value={settings.freeTrialActiveBookingLimit}
                  className="mt-2 h-11 border-slate-200 bg-white focus-visible:ring-teal-500"
                  onChange={(event) => updateSettings({ freeTrialActiveBookingLimit: Number(event.target.value) })}
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">Maximum pending or accepted complimentary bookings per patient.</p>
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
              <SelectTrigger id="paid-payment-timing" className="h-11 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOME_VISIT_PAYMENT_TIMINGS.map((timing) => (
                  <SelectItem key={timing.value} value={timing.value}>{timing.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">{selectedPaymentTiming?.description}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row gap-3 space-y-0">
            <div className="rounded-lg bg-sky-50 p-2.5 text-sky-700"><ShieldCheck className="size-5" /></div>
            <div>
              <CardTitle className="text-lg text-slate-900">Assignment completion</CardTitle>
              <CardDescription>Control whether a doctor may complete an assignment before its scheduled start time.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SettingsToggle
              id="allow-early-assignment-completion"
              label="Allow early assignment completion"
              description="When enabled, doctors may complete hospital assignments and patient home visits before their scheduled start time."
              checked={settings.allowEarlyAssignmentCompletion}
              onCheckedChange={(allowEarlyAssignmentCompletion) => updateSettings({ allowEarlyAssignmentCompletion })}
            />
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <p><span className="font-semibold">Change impact:</span> availability, trial, and payment-policy changes apply to new bookings only. Early assignment completion applies immediately to hospital assignments and home visits.</p>
        </div>
      </div>
    </main>
  );
}
