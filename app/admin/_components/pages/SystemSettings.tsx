'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Settings {
  general: {
    siteName: string;
    siteUrl: string;
    maintenanceMode: boolean;
    supportEmail: string;
    supportPhone: string;
    timezone: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
  };
  payment: {
    currency: string;
    paymentGateway: string;
    stripePublicKey: string;
    stripeSecretKey: string;
    commissionRate: number;
    autoBilling: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    smsEnabled: boolean;
    bookingUpdatesPush: boolean;
    bookingUpdatesEmail: boolean;
    paymentPush: boolean;
    remindersPush: boolean;
  };
  assignments: {
    routineTimeout: number;
    urgentTimeout: number;
    emergencyTimeout: number;
    enableReminders: boolean;
    autoReassign: boolean;
  };
  policy: {
    freeCancellationWindow: number;
    cancellationPenalty: number;
    maxCancellationsPerMonth: number;
    enablePenalty: boolean;
  };
}

const DEFAULT_SETTINGS: Settings = {
  general: {
    siteName: 'HealthCare Admin',
    siteUrl: 'https://admin.healthcare.com',
    maintenanceMode: false,
    supportEmail: 'support@healthcare.com',
    supportPhone: '+1 (555) 123-4567',
    timezone: 'pst',
  },
  email: {
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: 'noreply@healthcare.com',
    fromName: 'HealthCare Admin',
  },
  payment: {
    currency: 'USD',
    paymentGateway: 'stripe',
    stripePublicKey: '',
    stripeSecretKey: '',
    commissionRate: 15,
    autoBilling: true,
  },
  notifications: {
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    bookingUpdatesPush: true,
    bookingUpdatesEmail: true,
    paymentPush: true,
    remindersPush: true,
  },
  assignments: {
    routineTimeout: 30,
    urgentTimeout: 15,
    emergencyTimeout: 5,
    enableReminders: true,
    autoReassign: true,
  },
  policy: {
    freeCancellationWindow: 24,
    cancellationPenalty: 25,
    maxCancellationsPerMonth: 3,
    enablePenalty: true,
  },
};

export function SystemSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, notificationsRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/settings/notifications'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.success && data.data) {
          setSettings((prev) => ({
            ...prev,
            ...data.data,
          }));
        }
      }

      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        if (data.success && data.data) {
          setSettings((prev) => ({
            ...prev,
            notifications: {
              ...prev.notifications,
              ...data.data,
            },
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (section: string) => {
    try {
      setSaving(true);
      
      if (section === 'notifications') {
        const res = await fetch('/api/admin/settings/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings.notifications),
        });

        const data = await res.json();
        if (data.success) {
          toast.success('Notification settings saved successfully');
        } else {
          toast.error(data.message || 'Failed to save notification settings');
        }
      } else {
        const res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section,
            settings: settings[section as keyof Settings],
          }),
        });

        const data = await res.json();
        if (data.success) {
          toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully`);
        } else {
          toast.error(data.message || 'Failed to save settings');
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section: keyof Settings, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="System Settings" 
        description="Configure platform settings and preferences"
        actions={
          <Button 
            onClick={() => handleSave(activeTab)} 
            disabled={saving}
            className="bg-navy-600 hover:bg-navy-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        }
      />

      <div className="p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="policy">Cancellation Policy</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h3 className="text-slate-900">General Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <Label>Platform Name</Label>
                  <Input 
                    value={settings.general.siteName}
                    onChange={(e) => updateSetting('general', 'siteName', e.target.value)}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Site URL</Label>
                  <Input 
                    value={settings.general.siteUrl}
                    onChange={(e) => updateSetting('general', 'siteUrl', e.target.value)}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Support Email</Label>
                  <Input 
                    type="email" 
                    value={settings.general.supportEmail}
                    onChange={(e) => updateSetting('general', 'supportEmail', e.target.value)}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Support Phone</Label>
                  <Input 
                    type="tel" 
                    value={settings.general.supportPhone}
                    onChange={(e) => updateSetting('general', 'supportPhone', e.target.value)}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Timezone</Label>
                  <Select 
                    value={settings.general.timezone}
                    onValueChange={(value) => updateSetting('general', 'timezone', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pst">Pacific Standard Time</SelectItem>
                      <SelectItem value="est">Eastern Standard Time</SelectItem>
                      <SelectItem value="cst">Central Standard Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-slate-600 mt-1">Enable to restrict access during updates</p>
                  </div>
                  <Switch 
                    checked={settings.general.maintenanceMode}
                    onCheckedChange={(checked) => updateSetting('general', 'maintenanceMode', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assignments">
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h3 className="text-slate-900">Assignment Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <Label>Routine Assignment Timeout (minutes)</Label>
                  <Input 
                    type="number" 
                    value={settings.assignments.routineTimeout}
                    onChange={(e) => updateSetting('assignments', 'routineTimeout', parseInt(e.target.value))}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Urgent Assignment Timeout (minutes)</Label>
                  <Input 
                    type="number" 
                    value={settings.assignments.urgentTimeout}
                    onChange={(e) => updateSetting('assignments', 'urgentTimeout', parseInt(e.target.value))}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Emergency Assignment Timeout (minutes)</Label>
                  <Input 
                    type="number" 
                    value={settings.assignments.emergencyTimeout}
                    onChange={(e) => updateSetting('assignments', 'emergencyTimeout', parseInt(e.target.value))}
                    className="mt-1" 
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Enable Assignment Reminders</Label>
                    <p className="text-slate-600 mt-1">Send reminders for pending assignments</p>
                  </div>
                  <Switch 
                    checked={settings.assignments.enableReminders}
                    onCheckedChange={(checked) => updateSetting('assignments', 'enableReminders', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Auto-Reassign on Timeout</Label>
                    <p className="text-slate-600 mt-1">Automatically reassign if doctor doesn't respond</p>
                  </div>
                  <Switch 
                    checked={settings.assignments.autoReassign}
                    onCheckedChange={(checked) => updateSetting('assignments', 'autoReassign', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h3 className="text-slate-900">Notification Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-slate-600 mt-1">Enable email notifications</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.emailEnabled}
                    onCheckedChange={(checked) => updateSetting('notifications', 'emailEnabled', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Push Notifications</Label>
                    <p className="text-slate-600 mt-1">Enable push notifications</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.pushEnabled}
                    onCheckedChange={(checked) => updateSetting('notifications', 'pushEnabled', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>SMS Notifications</Label>
                    <p className="text-slate-600 mt-1">Enable SMS notifications</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.smsEnabled}
                    onCheckedChange={(checked) => updateSetting('notifications', 'smsEnabled', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Booking Updates (Push)</Label>
                    <p className="text-slate-600 mt-1">Send push notifications for booking updates</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.bookingUpdatesPush}
                    onCheckedChange={(checked) => updateSetting('notifications', 'bookingUpdatesPush', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Booking Updates (Email)</Label>
                    <p className="text-slate-600 mt-1">Send email notifications for booking updates</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.bookingUpdatesEmail}
                    onCheckedChange={(checked) => updateSetting('notifications', 'bookingUpdatesEmail', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Payment Notifications (Push)</Label>
                    <p className="text-slate-600 mt-1">Send push notifications for payments</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.paymentPush}
                    onCheckedChange={(checked) => updateSetting('notifications', 'paymentPush', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Reminder Notifications (Push)</Label>
                    <p className="text-slate-600 mt-1">Send push notifications for reminders</p>
                  </div>
                  <Switch 
                    checked={settings.notifications.remindersPush}
                    onCheckedChange={(checked) => updateSetting('notifications', 'remindersPush', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="policy">
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h3 className="text-slate-900">Cancellation Policy</h3>
              
              <div className="space-y-4">
                <div>
                  <Label>Free Cancellation Window (hours before appointment)</Label>
                  <Input 
                    type="number" 
                    value={settings.policy.freeCancellationWindow}
                    onChange={(e) => updateSetting('policy', 'freeCancellationWindow', parseInt(e.target.value))}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Cancellation Penalty Amount ($)</Label>
                  <Input 
                    type="number" 
                    value={settings.policy.cancellationPenalty}
                    onChange={(e) => updateSetting('policy', 'cancellationPenalty', parseInt(e.target.value))}
                    className="mt-1" 
                  />
                </div>
                
                <div>
                  <Label>Maximum Cancellations per Month</Label>
                  <Input 
                    type="number" 
                    value={settings.policy.maxCancellationsPerMonth}
                    onChange={(e) => updateSetting('policy', 'maxCancellationsPerMonth', parseInt(e.target.value))}
                    className="mt-1" 
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Enable Penalty System</Label>
                    <p className="text-slate-600 mt-1">Apply penalties for late cancellations</p>
                  </div>
                  <Switch 
                    checked={settings.policy.enablePenalty}
                    onCheckedChange={(checked) => updateSetting('policy', 'enablePenalty', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h3 className="text-slate-900">Payment Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <Label>Payment Gateway</Label>
                  <Select 
                    value={settings.payment.paymentGateway}
                    onValueChange={(value) => updateSetting('payment', 'paymentGateway', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Currency</Label>
                  <Select 
                    value={settings.payment.currency}
                    onValueChange={(value) => updateSetting('payment', 'currency', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>API Key</Label>
                  <Input 
                    type="password" 
                    value={settings.payment.stripeSecretKey}
                    onChange={(e) => updateSetting('payment', 'stripeSecretKey', e.target.value)}
                    className="mt-1" 
                    placeholder="sk_test_••••••••••••••••"
                  />
                </div>
                
                <div>
                  <Label>Public Key</Label>
                  <Input 
                    type="text" 
                    value={settings.payment.stripePublicKey}
                    onChange={(e) => updateSetting('payment', 'stripePublicKey', e.target.value)}
                    className="mt-1" 
                    placeholder="pk_test_••••••••••••••••"
                  />
                </div>
                
                <div>
                  <Label>Platform Commission Rate (%)</Label>
                  <Input 
                    type="number" 
                    value={settings.payment.commissionRate}
                    onChange={(e) => updateSetting('payment', 'commissionRate', parseFloat(e.target.value))}
                    className="mt-1" 
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label>Enable Auto-Billing</Label>
                    <p className="text-slate-600 mt-1">Automatically charge subscriptions</p>
                  </div>
                  <Switch 
                    checked={settings.payment.autoBilling}
                    onCheckedChange={(checked) => updateSetting('payment', 'autoBilling', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
