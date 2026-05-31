'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../_components/PageHeader';
import { Button } from '../_components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../_components/ui/card';
import { UserCheck, Stethoscope, Building2, Loader2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '../_components/StatusBadge';

export default function AdminVerificationsPage() {
  const router = useRouter();
  const [doctorStats, setDoctorStats] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [hospitalStats, setHospitalStats] = useState({ pending: 0, verified: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [doctorsRes, hospitalsRes] = await Promise.all([
        fetch('/api/admin/verifications/doctors?limit=1'),
        fetch('/api/admin/verifications/hospitals?limit=1'),
      ]);

      if (doctorsRes.ok) {
        const doctorsData = await doctorsRes.json();
        if (doctorsData.success) {
          const doctors = doctorsData.data || [];
          setDoctorStats({
            pending: doctors.filter((d: any) => d.licenseVerificationStatus === 'pending').length,
            verified: doctors.filter((d: any) => d.licenseVerificationStatus === 'verified').length,
            rejected: doctors.filter((d: any) => d.licenseVerificationStatus === 'rejected').length,
          });
        }
      }

      if (hospitalsRes.ok) {
        const hospitalsData = await hospitalsRes.json();
        if (hospitalsData.success) {
          const hospitals = hospitalsData.data || [];
          setHospitalStats({
            pending: hospitals.filter((h: any) => h.licenseVerificationStatus === 'pending').length,
            verified: hospitals.filter((h: any) => h.licenseVerificationStatus === 'verified').length,
            rejected: hospitals.filter((h: any) => h.licenseVerificationStatus === 'rejected').length,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching verification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Verifications" 
        description="Manage doctor and hospital verifications"
      />

      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Doctor Verifications Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/verifications/doctors')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-teal-100 rounded-lg">
                      <Stethoscope className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <CardTitle>Doctor Verifications</CardTitle>
                      <CardDescription>Review and verify doctor applications</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">{doctorStats.pending}</div>
                    <div className="text-sm text-slate-600 mt-1">Pending</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{doctorStats.verified}</div>
                    <div className="text-sm text-slate-600 mt-1">Verified</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{doctorStats.rejected}</div>
                    <div className="text-sm text-slate-600 mt-1">Rejected</div>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4 bg-teal-600 hover:bg-teal-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/admin/verifications/doctors');
                  }}
                >
                  Manage Doctor Verifications
                </Button>
              </CardContent>
            </Card>

            {/* Hospital Verifications Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/verifications/hospitals')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-navy-100 rounded-lg">
                      <Building2 className="w-6 h-6 text-navy-600" />
                    </div>
                    <div>
                      <CardTitle>Hospital Verifications</CardTitle>
                      <CardDescription>Review and verify hospital applications</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">{hospitalStats.pending}</div>
                    <div className="text-sm text-slate-600 mt-1">Pending</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{hospitalStats.verified}</div>
                    <div className="text-sm text-slate-600 mt-1">Verified</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{hospitalStats.rejected}</div>
                    <div className="text-sm text-slate-600 mt-1">Rejected</div>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4 bg-navy-600 hover:bg-navy-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/admin/verifications/hospitals');
                  }}
                >
                  Manage Hospital Verifications
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
