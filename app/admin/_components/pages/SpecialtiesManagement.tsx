'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';
import { ProceduresManagement } from './ProceduresManagement';
import { SPECIALTY_LIST_DEFAULT_LIMIT } from '@/lib/enums/specialties.enums';

interface Specialty {
  id: string;
  name: string;
  description: string | null;
  activeDoctors: number;
  activeHospitals: number;
}

export function SpecialtiesManagement() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [specialtyToDelete, setSpecialtyToDelete] = useState<Specialty | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedSpecialtyForProcedures, setSelectedSpecialtyForProcedures] = useState<Specialty | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    fetchSpecialties();
  }, [page, searchQuery]);

  const fetchSpecialties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: SPECIALTY_LIST_DEFAULT_LIMIT.toString(),
      });
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await apiClient.get(`/api/admin/specialties?${params.toString()}`);
      const data = response.data;

      if (data.success) {
        setSpecialties(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        toast.error(data.message || 'Failed to fetch specialties');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch specialties');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiClient.post('/api/admin/specialties', {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
      const data = response.data;

      if (data.success) {
        toast.success('Specialty created successfully');
        const savedSpecialty = data.data;
        setIsCreating(false);
        setFormData({ name: '', description: '' });
        fetchSpecialties();

        if (savedSpecialty) {
          setSelectedSpecialtyForProcedures(savedSpecialty);
          setIsEditMode(true);
        }
      } else {
        toast.error(data.message || 'Failed to save specialty');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save specialty');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setFormData({ name: '', description: '' });
  };

  const handleDelete = async () => {
    if (!specialtyToDelete) return;

    try {
      setDeleting(true);
      const response = await apiClient.delete(`/api/admin/specialties/${specialtyToDelete.id}`);
      const data = response.data;

      if (data.success) {
        toast.success('Specialty deleted successfully');
        setSpecialtyToDelete(null);
        fetchSpecialties();
      } else {
        toast.error(data.message || 'Failed to delete specialty');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete specialty');
    } finally {
      setDeleting(false);
    }
  };

  const columns: AdminDataTableColumn<Specialty>[] = [
    {
      id: 'specialty',
      label: 'Specialty',
      widthClassName: 'w-[26%]',
      cell: (specialty) => (
        <span className="font-medium text-slate-900">{specialty.name}</span>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      widthClassName: 'w-[30%]',
      cell: (specialty) => (
        <span className="block truncate text-slate-600">{specialty.description || '-'}</span>
      ),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      widthClassName: 'w-[20%]',
      cell: (specialty) => (
        <div className="flex flex-col gap-1 text-xs text-slate-600">
          <span>{specialty.activeDoctors} Doctors</span>
          <span>{specialty.activeHospitals} Hospitals</span>
        </div>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      widthClassName: 'w-[28%]',
      sticky: 'right',
      headerClassName: 'min-w-[260px]',
      cellClassName: 'min-w-[260px]',
      cell: (specialty) => (
        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedSpecialtyForProcedures(specialty);
              setIsEditMode(false);
            }}
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            View
          </Button>
          <Button
            size="sm"
            className="bg-navy-600 text-white hover:bg-navy-700"
            onClick={() => {
              setSelectedSpecialtyForProcedures(specialty);
              setIsEditMode(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSpecialtyToDelete(specialty)}
            className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label={`Delete ${specialty.name}`}
          >
            <Trash2 className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <PageHeader
        title="Medical & Clinical Management"
        description="Manage medical specialties, therapeutic categories, and clinical procedures"
        actions={
          <Button onClick={() => setIsCreating(true)} className="bg-navy-600 hover:bg-navy-700" disabled={isCreating}>
            <Plus className="w-4 h-4 mr-2" />
            Add Specialty
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">

          {isCreating && (
            <div className="bg-white rounded-xl shadow-lg border border-navy-100 p-8 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-navy-900 font-bold text-lg">
                  <Plus className="w-5 h-5 text-teal-600" />
                  <span>Setup New Medical Specialty</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Specialty *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter Specialty (e.g. Cardiology)"
                    className="h-11 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief overview of the therapeutic focus"
                    className="h-11 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                <Button variant="ghost" onClick={handleCancelCreate} disabled={submitting} className="h-11 px-6">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="bg-navy-600 hover:bg-navy-700 min-w-[160px] h-11 px-6 shadow-sm">
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create & Continue
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="relative max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search specialties..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="h-11 border-slate-300 bg-white pl-10 shadow-sm"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
                <p className="text-slate-600">Loading specialties...</p>
              </div>
            ) : (
              <AdminDataTable
                columns={columns}
                data={specialties}
                emptyMessage="No specialties found"
                getRowKey={(specialty) => specialty.id}
                minWidthClassName="min-w-[980px]"
              />
            )}

            {!loading && totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedSpecialtyForProcedures}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSpecialtyForProcedures(null);
            setIsEditMode(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-[95vw] flex-col overflow-hidden bg-white p-0 sm:max-w-[90vw] lg:max-w-6xl">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="space-y-1">
                <DialogTitle className="text-xl text-slate-900">
                  {isEditMode ? 'Edit hierarchy' : 'View hierarchy'}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  {selectedSpecialtyForProcedures?.name} · manage its specialty, categories, and procedures
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditMode((current) => !current)}
                aria-label={isEditMode ? 'View specialty hierarchy' : 'Edit specialty hierarchy'}
                className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {isEditMode ? 'View' : 'Edit'}
              </Button>
            </div>
          </DialogHeader>
          {selectedSpecialtyForProcedures && (
            <div className="max-h-[calc(90vh-96px)] overflow-y-auto">
              <ProceduresManagement
                key={`${selectedSpecialtyForProcedures.id}-${isEditMode ? 'edit' : 'view'}`}
                specialtyId={selectedSpecialtyForProcedures.id}
                specialtyName={selectedSpecialtyForProcedures.name}
                hideHeader
                readOnly={!isEditMode}
                defaultTab={isEditMode ? 'details' : 'categories'}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(specialtyToDelete)}
        onOpenChange={(open) => !open && setSpecialtyToDelete(null)}
      >
        <AlertDialogContent className="max-w-md border-slate-200 bg-white p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete specialty</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{specialtyToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting...' : 'Delete specialty'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
