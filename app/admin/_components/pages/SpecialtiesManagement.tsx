'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Edit, Trash2, Loader2, ListTree, Tag } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ProceduresManagement } from './ProceduresManagement';

interface Specialty {
  id: string;
  name: string;
  description: string | null;
  activeDoctors: number;
  activeHospitals: number;
  status: string;
}

export function SpecialtiesManagement() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSpecialtyForProcedures, setSelectedSpecialtyForProcedures] = useState<Specialty | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    fetchSpecialties();
  }, [searchQuery]);

  const fetchSpecialties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      params.append('limit', '100');

      const res = await fetch(`/api/admin/specialties?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setSpecialties(data.data || []);
      } else {
        toast.error(data.message || 'Failed to fetch specialties');
      }
    } catch (error) {
      console.error('Error fetching specialties:', error);
      toast.error('Failed to fetch specialties');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    // Name is required
    if (!formData.name.trim()) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!validateForm()) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const url = editingSpecialty
        ? `/api/admin/specialties/${editingSpecialty.id}`
        : '/api/admin/specialties';
      
      const method = editingSpecialty ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingSpecialty ? 'Specialty updated successfully' : 'Specialty created successfully');
        const savedSpecialty = data.data;
        setIsCreating(false);
        setEditingSpecialty(null);
        setFormData({ name: '', description: '' });
        fetchSpecialties();
        
        // Auto-open hierarchy modal for newly created specialty
        if (!editingSpecialty && savedSpecialty) {
            setSelectedSpecialtyForProcedures(savedSpecialty);
            setIsEditMode(true);
        }
      } else {
        toast.error(data.message || 'Failed to save specialty');
      }
    } catch (error) {
      console.error('Error saving specialty:', error);
      toast.error('Failed to save specialty');
    } finally {
      setSubmitting(false);
    }
  };



  const handleDelete = async (specialty: Specialty) => {
    if (!confirm(`Are you sure you want to delete "${specialty.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(specialty.id);
      const res = await fetch(`/api/admin/specialties/${specialty.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Specialty deleted successfully');
        fetchSpecialties();
      } else {
        toast.error(data.message || 'Failed to delete specialty');
      }
    } catch (error) {
      console.error('Error deleting specialty:', error);
      toast.error('Failed to delete specialty');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setFormData({ name: '', description: '' });
  };

  const filteredSpecialties = specialties.filter((specialty) =>
    specialty.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (specialty.description && specialty.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50">
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

      <div className="p-8">
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
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter Specialty (e.g. Cardiology)"
                    className="h-11 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-semibold">Description</Label>
                  <Input 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
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

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search specialties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-slate-600">Specialty</th>
                      <th className="px-6 py-3 text-left text-slate-600">Description</th>
                      <th className="px-6 py-3 text-left text-slate-600 font-medium">Analytics</th>
                      <th className="px-6 py-3 text-left text-slate-600">Status</th>
                      <th className="px-6 py-3 text-left text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                      {filteredSpecialties.length === 0 && !isCreating ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                            {searchQuery ? 'No specialties found matching your search' : 'No specialties found'}
                          </td>
                        </tr>
                      ) : (
                        filteredSpecialties.map((specialty) => (
                          <tr key={specialty.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-900 font-medium">{specialty.name}</td>
                            <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{specialty.description || '-'}</td>
                            <td className="px-6 py-4 text-slate-600">
                              <div className="flex flex-col text-xs gap-1">
                                <span>{specialty.activeDoctors} Doctors</span>
                                <span>{specialty.activeHospitals} Hospitals</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={specialty.status} />
                            </td>
                             <td className="px-6 py-4">
                               <div className="flex items-center gap-2">
                                 <Button 
                                   size="sm" 
                                   variant="outline"
                                   onClick={() => {
                                     setSelectedSpecialtyForProcedures(specialty);
                                     setIsEditMode(false);
                                   }}
                                   className="text-slate-600 border-slate-200 hover:bg-slate-50"
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
                                  onClick={() => handleDelete(specialty)}
                                  disabled={deletingId === specialty.id}
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  {deletingId === specialty.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

      <Dialog 
        open={!!selectedSpecialtyForProcedures} 
        onOpenChange={(open) => !open && setSelectedSpecialtyForProcedures(null)}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-4xl lg:max-w-5xl bg-white max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
            <DialogTitle className="text-xl text-slate-900 flex items-center justify-between">
              <span>{isEditMode ? 'Edit' : 'View'} Hierarchy - {selectedSpecialtyForProcedures?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedSpecialtyForProcedures && (
            <div className="flex-1 overflow-y-auto">
              <ProceduresManagement 
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
    </div>
  );
}
