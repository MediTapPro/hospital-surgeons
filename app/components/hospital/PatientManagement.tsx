'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Eye, UserPlus, CheckCircle, AlertCircle, XCircle, Loader2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { AddPatientWizard } from './AddPatientWizard';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../hospital/_components/PageHeader';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';

export function PatientManagement() {
  const router = useRouter();
  
  const onNavigate = (page: string) => {
    router.push(`/hospital/${page}`);
  };
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const PAGE_LIMIT = 10;

  useEffect(() => {
    if (isAuthenticated()) {
      fetchHospitalProfile();
    } else {
      router.push('/login');
    }
  }, []);

  // Debounce search input by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // reset to page 1 on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (hospitalId) {
      fetchPatients();
      fetchUsage();
    }
  }, [hospitalId, currentPage, debouncedSearch]);

  const fetchHospitalProfile = async () => {
    try {
      const response = await apiClient.get('/api/hospitals/profile');
      const data = response.data;
      if (data.success && data.data) {
        setHospitalId(data.data.id);
      } else {
        setError('Failed to load hospital profile');
      }
    } catch (err: any) {
      console.error('Error fetching hospital profile:', err);
      if (err.response?.status === 401) {
        router.push('/login');
        return;
      }
      setError('Failed to load hospital profile');
    }
  };

  const fetchUsage = async () => {
    if (!hospitalId) return;
    
    try {
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/usage`);
      if (response.data.success && response.data.data) {
        // Extract patient usage from the combined usage response
        setUsage({
          used: response.data.data.patients.used,
          limit: response.data.data.patients.limit,
          percentage: response.data.data.patients.percentage,
          status: response.data.data.patients.status,
          remaining: response.data.data.patients.remaining,
          resetDate: response.data.data.resetDate,
          plan: response.data.data.plan,
        });
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const fetchPatients = async () => {
    if (!hospitalId) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_LIMIT),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const response = await apiClient.get(`/api/hospitals/${hospitalId}/patients?${params.toString()}`);
      const result = response.data;
      if (result.success && result.data) {
        setPatients(result.data);
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages);
          setTotalPatients(result.pagination.total);
        }
      } else {
        setError('Failed to load patients');
      }
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      setError(error.response?.data?.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Assigned
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'unassigned':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unassigned
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800">
            {status}
          </Badge>
        );
    }
  };

  if (showAddPatient) {
    return (
      <AddPatientWizard
        onClose={() => setShowAddPatient(false)}
        onComplete={() => {
          setShowAddPatient(false);
          fetchPatients(); // Refresh the patient list
        }}
      />
    );
  }

  if (loading && !hospitalId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Patient Management" 
        description="Manage patient records and assignments"
        actions={
          <Button onClick={() => setShowAddPatient(true)} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Patient
          </Button>
        }
      />
      <div className="p-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Usage Banner */}
        {usage && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {usage.used} / {usage.limit === -1 ? 'Unlimited' : usage.limit} patients added this month
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Resets on {new Date(usage.resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {usage.status === 'reached' && (
                <button
                  onClick={() => router.push('/hospital/subscriptions')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
            {usage.limit !== -1 && (
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    usage.status === 'reached' ? 'bg-red-500' :
                    usage.status === 'critical' ? 'bg-orange-500' :
                    usage.status === 'warning' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                />
              </div>
            )}
            {(usage.status === 'critical' || usage.status === 'warning') && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${
                usage.status === 'critical' 
                  ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                  : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}>
                ⚠️ Almost at limit! {usage.remaining} patient{usage.remaining !== 1 ? 's' : ''} remaining. 
                <button
                  onClick={() => router.push('/hospital/subscriptions')}
                  className="ml-2 underline font-medium"
                >
                  View Plans
                </button>
              </div>
            )}
          </div>
        )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h3 className="text-slate-900 font-semibold">All Patients</h3>
        </div>
        <div>
          {/* Search and Filter */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, condition, or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>

          {/* Patients Table */}
          <div className="border rounded-lg">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                <p className="text-slate-600">Loading patients...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-600 mb-4">No patients found</p>
                <Button onClick={() => setShowAddPatient(true)} className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Patient
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Age / Gender</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Medical Condition</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Assigned Doctor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>{patient.name}</TableCell>
                    <TableCell>{patient.age} / {patient.gender}</TableCell>
                    <TableCell>{new Date(patient.admissionDate).toLocaleDateString()}</TableCell>
                    <TableCell>{patient.condition}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{patient.specialtyName || patient.specialty}</Badge>
                    </TableCell>
                    <TableCell>
                      {patient.assignedDoctor || (
                        <span className="text-gray-400">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(patient.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setShowViewModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setShowEditModal(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {(patient.status === 'unassigned' || patient.status === 'declined') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate('find-doctors')}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-slate-600">
                Showing {((currentPage - 1) * PAGE_LIMIT) + 1}–{Math.min(currentPage * PAGE_LIMIT, totalPatients)} of {totalPatients} patients
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* View Patient Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>Complete patient information</DialogDescription>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <Label className="text-gray-500 text-sm">Full Name</Label>
                  <p className="text-gray-900 mt-1">{selectedPatient.name}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <Label className="text-gray-500 text-sm">Age / Gender</Label>
                  <p className="text-gray-900 mt-1">{selectedPatient.age} years / {selectedPatient.gender}</p>
                </div>
              </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                <Label className="text-gray-500 text-sm">Admission Date</Label>
                <p className="text-gray-900 mt-1">{new Date(selectedPatient.admissionDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              <Separator />

                <div className="p-4 bg-slate-50 rounded-lg">
                <Label className="text-gray-500 text-sm">Medical Condition</Label>
                <p className="text-gray-900 mt-1">{selectedPatient.condition}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <Label className="text-gray-500 text-sm">Required Specialty</Label>
                  <p className="text-gray-900 mt-1">{selectedPatient.specialty}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <Label className="text-gray-500 text-sm">Assignment Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedPatient.status)}</div>
                </div>
              </div>

              {selectedPatient.assignedDoctor && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Label className="text-blue-900 text-sm">Assigned Doctor</Label>
                  <p className="text-blue-900 mt-1">{selectedPatient.assignedDoctor}</p>
                </div>
              )}

                <div className="p-4 bg-slate-50 rounded-lg">
                <Label className="text-gray-500 text-sm">Contact Information</Label>
                <div className="space-y-1 mt-2 text-sm">
                  <p className="text-gray-900">Phone: +91 98765 43210</p>
                  <p className="text-gray-900">Emergency Contact: +91 98765 00000</p>
                  <p className="text-gray-900">Address: 123 Main Street, Mumbai, Maharashtra</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowViewModal(false);
              setShowEditModal(true);
            }}>
              Edit Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Patient Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Patient Information</DialogTitle>
            <DialogDescription>Update patient details</DialogDescription>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Full Name</Label>
                  <Input id="editName" defaultValue={selectedPatient.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editAge">Age</Label>
                  <Input id="editAge" type="number" defaultValue={selectedPatient.age} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editCondition">Medical Condition</Label>
                <Input id="editCondition" defaultValue={selectedPatient.condition} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editPhone">Phone Number</Label>
                <Input id="editPhone" type="tel" defaultValue="+91 98765 43210" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmergency">Emergency Contact</Label>
                <Input id="editEmergency" type="tel" defaultValue="+91 98765 00000" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowEditModal(false);
              alert('Patient information updated successfully!');
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}