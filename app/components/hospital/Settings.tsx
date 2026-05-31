'use client';

import { useState } from 'react';
import { Bell, Lock, Globe, Clock, Shield, Key, Mail, Phone, Smartphone, Moon, Sun, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';

export function Settings() {
  const [notifications, setNotifications] = useState({
    emailAssignments: true,
    emailPayments: true,
    smsUrgent: true,
    smsAll: false,
    pushAssignments: true,
    pushReminders: true,
  });

  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: 'Asia/Kolkata',
    theme: 'light',
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
  });

  const [security, setSecurity] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '30',
    loginAlerts: true,
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-gray-900 mb-1">Settings</h1>
        <p className="text-gray-500">Manage your account and application preferences</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="hospital">Hospital</TabsTrigger>
        </TabsList>

        {/* Account Settings */}
        <TabsContent value="account">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Update your account details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hospitalName">Hospital Name</Label>
                    <Input id="hospitalName" defaultValue="MediCare Multi-Specialty Hospital" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountEmail">Account Email</Label>
                    <Input id="accountEmail" type="email" defaultValue="admin@medicare.com" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminName">Administrator Name</Label>
                    <Input id="adminName" defaultValue="Dr. Rajesh Kumar" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPhone">Administrator Phone</Label>
                    <Input id="adminPhone" type="tel" defaultValue="+91 98765 43210" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="billingEmail">Billing Email</Label>
                  <Input id="billingEmail" type="email" defaultValue="billing@medicare.com" />
                  <p className="text-sm text-gray-500">Invoices and payment receipts will be sent to this email</p>
                </div>

                <Button>Save Changes</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
                <CardDescription>Irreversible actions for your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                  <div>
                    <h3 className="text-gray-900 mb-1">Delete Account</h3>
                    <p className="text-sm text-gray-600">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Manage email notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="emailAssignments">Assignment Updates</Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Receive emails when doctors accept or decline assignments
                    </p>
                  </div>
                  <Switch
                    id="emailAssignments"
                    checked={notifications.emailAssignments}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailAssignments: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="emailPayments">Payment Confirmations</Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Receive emails for subscription payments and invoices
                    </p>
                  </div>
                  <Switch
                    id="emailPayments"
                    checked={notifications.emailPayments}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailPayments: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SMS Notifications</CardTitle>
                <CardDescription>Manage SMS notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="smsUrgent">Urgent Assignments</Label>
                      <Badge variant="secondary" className="ml-2">Recommended</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Receive SMS for urgent and emergency assignments
                    </p>
                  </div>
                  <Switch
                    id="smsUrgent"
                    checked={notifications.smsUrgent}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, smsUrgent: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="smsAll">All Assignment Updates</Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Receive SMS for all assignment status changes
                    </p>
                  </div>
                  <Switch
                    id="smsAll"
                    checked={notifications.smsAll}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, smsAll: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Push Notifications</CardTitle>
                <CardDescription>Manage browser push notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="pushAssignments">Assignment Notifications</Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Get instant notifications when assignments are updated
                    </p>
                  </div>
                  <Switch
                    id="pushAssignments"
                    checked={notifications.pushAssignments}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, pushAssignments: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="pushReminders">Reminders</Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Receive reminders for upcoming appointments
                    </p>
                  </div>
                  <Switch
                    id="pushReminders"
                    checked={notifications.pushReminders}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, pushReminders: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" />
                </div>
                <Button>Update Password</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="twoFactor">Enable Two-Factor Authentication</Label>
                      {security.twoFactorEnabled && (
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Require a verification code in addition to your password
                    </p>
                  </div>
                  <Switch
                    id="twoFactor"
                    checked={security.twoFactorEnabled}
                    onCheckedChange={(checked) =>
                      setSecurity({ ...security, twoFactorEnabled: checked })
                    }
                  />
                </div>

                {security.twoFactorEnabled && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm text-blue-900 mb-2">Setup Instructions</h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Download an authenticator app (Google Authenticator, Authy)</li>
                      <li>Scan the QR code or enter the setup key</li>
                      <li>Enter the 6-digit code to verify</li>
                    </ol>
                    <Button size="sm" className="mt-3">Configure 2FA</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session Management</CardTitle>
                <CardDescription>Control your active sessions and timeout settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout</Label>
                  <Select value={security.sessionTimeout} onValueChange={(value) => setSecurity({ ...security, sessionTimeout: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    Automatically log out after this period of inactivity
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-gray-500" />
                      <Label htmlFor="loginAlerts">Login Alerts</Label>
                    </div>
                    <p className="text-sm text-gray-500">
                      Get notified of new login attempts from unrecognized devices
                    </p>
                  </div>
                  <Switch
                    id="loginAlerts"
                    checked={security.loginAlerts}
                    onCheckedChange={(checked) =>
                      setSecurity({ ...security, loginAlerts: checked })
                    }
                  />
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm text-gray-900 mb-3">Active Sessions</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-900">Chrome on Windows</p>
                          <p className="text-xs text-gray-500">Mumbai, India • Active now</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Current</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-900">Safari on iPhone</p>
                          <p className="text-xs text-gray-500">Mumbai, India • 2 hours ago</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">Revoke</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize how the application looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => setPreferences({ ...preferences, theme: 'light' })}
                      className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                        preferences.theme === 'light' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                      <span className="text-sm">Light</span>
                    </button>
                    <button
                      onClick={() => setPreferences({ ...preferences, theme: 'dark' })}
                      className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                        preferences.theme === 'dark' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                      <span className="text-sm">Dark</span>
                    </button>
                    <button
                      onClick={() => setPreferences({ ...preferences, theme: 'system' })}
                      className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 ${
                        preferences.theme === 'system' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <Monitor className="w-5 h-5" />
                      <span className="text-sm">System</span>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Settings</CardTitle>
                <CardDescription>Set your language, timezone, and format preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select value={preferences.language} onValueChange={(value) => setPreferences({ ...preferences, language: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                        <SelectItem value="mr">Marathi</SelectItem>
                        <SelectItem value="ta">Tamil</SelectItem>
                        <SelectItem value="te">Telugu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select value={preferences.timezone} onValueChange={(value) => setPreferences({ ...preferences, timezone: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Select value={preferences.dateFormat} onValueChange={(value) => setPreferences({ ...preferences, dateFormat: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={preferences.currency} onValueChange={(value) => setPreferences({ ...preferences, currency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button>Save Preferences</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hospital Settings */}
        <TabsContent value="hospital">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Operating Hours</CardTitle>
                <CardDescription>Set your hospital's operating hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="openTime">Opening Time</Label>
                    <Input id="openTime" type="time" defaultValue="08:00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="closeTime">Closing Time</Label>
                    <Input id="closeTime" type="time" defaultValue="20:00" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="24hours">24/7 Operation</Label>
                    <p className="text-sm text-gray-500">Hospital operates around the clock</p>
                  </div>
                  <Switch id="24hours" />
                </div>

                <Button>Save Operating Hours</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
                <CardDescription>Set emergency contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Emergency Phone Number</Label>
                  <Input id="emergencyPhone" type="tel" defaultValue="+91 98765 00000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyEmail">Emergency Email</Label>
                  <Input id="emergencyEmail" type="email" defaultValue="emergency@medicare.com" />
                </div>
                <Button>Save Emergency Contact</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assignment Defaults</CardTitle>
                <CardDescription>Set default values for new assignments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultPriority">Default Priority Level</Label>
                  <Select defaultValue="routine">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoReminder">Auto Reminder Time (hours before appointment)</Label>
                  <Select defaultValue="24">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button>Save Defaults</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
