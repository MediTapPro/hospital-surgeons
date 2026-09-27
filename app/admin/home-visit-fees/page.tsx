'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../_components/PageHeader';
import { Button } from '../_components/ui/button';
import { Input } from '../_components/ui/input';
import { Label } from '../_components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../_components/ui/dialog';
import { Loader2, Trash2, Edit, Plus, Percent, Coins } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/httpClient';
import { formatPlatformCurrency } from '@/lib/utils/constants';
import { AdminDataTable, type AdminDataTableColumn } from '../_components/ui/AdminDataTable';

type Specialty = { id: string; name: string };
type FeeConfig = { id: string; specialtyId: string | null; specialtyName?: string | null; fee: number | string; platformCommissionPercentage: number | string };

export default function HomeVisitFeesPage() {
  // Home Visit Fees States
  const [homeVisitFees, setHomeVisitFees] = useState<FeeConfig[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [defaultFee, setDefaultFee] = useState<string>('0');
  const [defaultCommission, setDefaultCommission] = useState<string>('10');
  const [defaultConfigId, setDefaultConfigId] = useState<string | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFeeConfig, setEditingFeeConfig] = useState<any | null>(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('');
  const [overrideFee, setOverrideFee] = useState<string>('');
  const [overrideCommission, setOverrideCommission] = useState<string>('');
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);

  useEffect(() => {
    fetchHomeVisitFees();
    fetchSpecialties();
  }, []);

  const fetchHomeVisitFees = async () => {
    try {
      setLoadingFees(true);
      const { data } = await apiClient.get('/api/admin/home-visit-fees');
      if (data.success && data.data) {
        setHomeVisitFees(data.data);
        
        // Find default config (specialtyId === null)
        const def = data.data.find((f: any) => f.specialtyId === null);
        if (def) {
          setDefaultFee(Number(def.fee).toString());
          setDefaultCommission(Number(def.platformCommissionPercentage).toString());
          setDefaultConfigId(def.id);
        }
      } else {
        toast.error(data.message || 'Failed to fetch platform fees');
      }
    } catch (error) {
      console.error('Error fetching fees:', error);
      toast.error('Error loading platform fees');
    } finally {
      setLoadingFees(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const { data } = await apiClient.get('/api/admin/specialties?limit=100');
      if (data.success && data.data) {
        setSpecialties(data.data);
      }
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };
  const handleSaveDefaultFee = async () => {
    const feeVal = parseFloat(defaultFee);
    const commVal = parseFloat(defaultCommission);

    if (isNaN(feeVal) || feeVal < 0) {
      toast.error('Please enter a valid, non-negative consultation fee');
      return;
    }

    if (isNaN(commVal) || commVal < 0 || commVal > 100) {
      toast.error('Platform commission percentage must be a number between 0 and 100');
      return;
    }

    try {
      setSavingDefault(true);
      const { data } = await apiClient.post('/api/admin/home-visit-fees', {
          specialtyId: null,
          fee: feeVal,
          platformCommissionPercentage: commVal,
      });
      if (data.success) {
        toast.success('Default platform fee configuration saved');
        fetchHomeVisitFees();
      } else {
        toast.error(data.message || 'Failed to save default fee config');
      }
    } catch (error) {
      console.error('Error saving default fee config:', error);
      toast.error('Error saving default configuration');
    } finally {
      setSavingDefault(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedSpecialtyId && !editingFeeConfig) {
      toast.error('Please select a specialty');
      return;
    }

    const feeVal = parseFloat(overrideFee);
    const commVal = parseFloat(overrideCommission);

    if (isNaN(feeVal) || feeVal < 0) {
      toast.error('Please enter a valid, non-negative consultation fee');
      return;
    }

    if (isNaN(commVal) || commVal < 0 || commVal > 100) {
      toast.error('Platform commission percentage must be a number between 0 and 100');
      return;
    }

    try {
      setSavingOverride(true);
      const { data } = await apiClient.post('/api/admin/home-visit-fees', {
          specialtyId: editingFeeConfig ? editingFeeConfig.specialtyId : selectedSpecialtyId,
          fee: feeVal,
          platformCommissionPercentage: commVal,
      });
      if (data.success) {
        toast.success(editingFeeConfig ? 'Override updated successfully' : 'Override created successfully');
        setShowAddModal(false);
        setEditingFeeConfig(null);
        setSelectedSpecialtyId('');
        setOverrideFee('');
        setOverrideCommission('');
        fetchHomeVisitFees();
      } else {
        toast.error(data.message || 'Failed to save override');
      }
    } catch (error) {
      console.error('Error saving override:', error);
      toast.error('Error saving override configuration');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!confirm('Are you sure you want to delete this specialty override?')) return;
    try {
      const { data } = await apiClient.delete(`/api/admin/home-visit-fees/${id}`);
      if (data.success) {
        toast.success('Specialty override deleted successfully');
        fetchHomeVisitFees();
      } else {
        toast.error(data.message || 'Failed to delete override');
      }
    } catch (error) {
      console.error('Error deleting override:', error);
      toast.error('Error deleting override configuration');
    }
  };

  const overrides = homeVisitFees.filter((feeConfig) => feeConfig.specialtyId !== null);
  const columns: AdminDataTableColumn<FeeConfig>[] = [
    { id: 'specialty', label: 'Specialty', widthClassName: 'w-[250px]', cell: (feeConfig) => <span className="font-medium text-slate-900">{feeConfig.specialtyName || specialties.find((specialty) => specialty.id === feeConfig.specialtyId)?.name || 'Unknown specialty'}</span> },
    { id: 'fee', label: 'Consultation fee', widthClassName: 'w-[180px]', cell: (feeConfig) => formatPlatformCurrency(Number(feeConfig.fee)) },
    { id: 'commission', label: 'Platform commission', widthClassName: 'w-[220px]', cell: (feeConfig) => { const fee = Number(feeConfig.fee); const percentage = Number(feeConfig.platformCommissionPercentage); return `${percentage.toFixed(1)}% (${formatPlatformCurrency(fee * percentage / 100)})`; } },
    { id: 'doctor-share', label: 'Doctor share', widthClassName: 'w-[170px]', cell: (feeConfig) => { const fee = Number(feeConfig.fee); const percentage = Number(feeConfig.platformCommissionPercentage); return <span className="font-semibold text-emerald-600">{formatPlatformCurrency(fee * (1 - percentage / 100))}</span>; } },
    { id: 'actions', label: 'Actions', widthClassName: 'w-[130px]', sticky: 'right', cell: (feeConfig) => <div className="flex items-center justify-center gap-2"><Button variant="outline" size="sm" onClick={() => { setEditingFeeConfig(feeConfig); setSelectedSpecialtyId(feeConfig.specialtyId || ''); setOverrideFee(Number(feeConfig.fee).toString()); setOverrideCommission(Number(feeConfig.platformCommissionPercentage).toString()); setShowAddModal(true); }} aria-label={`Edit ${feeConfig.specialtyName || 'specialty override'}`}><Edit className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" onClick={() => handleDeleteOverride(feeConfig.id)} aria-label={`Delete ${feeConfig.specialtyName || 'specialty override'}`} className="border-red-100 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button></div> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Home Visit Fee Controls" 
        description="Configure consultation fees and platform commission splits for patient home visits"
      />

      <div className="p-8 space-y-6 max-w-6xl mx-auto">
        {/* Default Platform Fee Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 transition-all duration-300 hover:shadow-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-slate-100 rounded-lg text-slate-800">
              <Coins className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 m-0">Platform-Wide Default Fee</h3>
              <p className="text-sm text-slate-500 mt-0.5">Fallback fee and commission percentage used when specialty-specific overrides are not defined.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <Label htmlFor="default-fee" className="text-sm font-medium text-slate-700">Default Consultation Fee (INR)</Label>
              <div className="relative">
                <Input
                  id="default-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={defaultFee}
                  onChange={(e) => setDefaultFee(e.target.value)}
                  className="pl-8 focus-visible:ring-teal-500 border-slate-200"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-commission" className="text-sm font-medium text-slate-700">Default Platform Commission (%)</Label>
              <div className="relative">
                <Input
                  id="default-commission"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={defaultCommission}
                  onChange={(e) => setDefaultCommission(e.target.value)}
                  className="pl-8 focus-visible:ring-teal-500 border-slate-200"
                  placeholder="10.0"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSaveDefaultFee}
              disabled={savingDefault || loadingFees}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-transform active:scale-[0.98]"
            >
              {savingDefault ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Update Default Fee'
              )}
            </Button>
          </div>
        </div>

        {/* Specialty Overrides Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 transition-all duration-300 hover:shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 m-0">Specialty-Specific Fees</h3>
              <p className="text-sm text-slate-500 mt-0.5">Manage custom fees and commission splits for specific medical specialties.</p>
            </div>
            <Button
              onClick={() => {
                setEditingFeeConfig(null);
                setSelectedSpecialtyId('');
                setOverrideFee('');
                setOverrideCommission('');
                setShowAddModal(true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2 self-start sm:self-center shadow-sm transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Add Specialty Override
            </Button>
          </div>

          {loadingFees ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : overrides.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
              <Coins className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No specialty overrides defined</p>
              <p className="text-slate-400 text-sm mt-1">Platform will use the default fallback fee configuration for all specialties.</p>
            </div>
          ) : (
            <AdminDataTable columns={columns} data={overrides} emptyMessage="No specialty overrides defined" getRowKey={(feeConfig) => feeConfig.id} minWidthClassName="min-w-[950px]" pagination={{ client: true, page: tablePage, pageSize: tablePageSize, total: overrides.length, onPageChange: setTablePage, onPageSizeChange: (size) => { setTablePageSize(size); setTablePage(1); }, disabled: loadingFees }} />
          )}
        </div>
      </div>

      {/* Override Add/Edit Dialog Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-xl rounded-xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-slate-950">
              {editingFeeConfig ? 'Edit Specialty Override' : 'Add Specialty Override'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Specialty</Label>
              {editingFeeConfig ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium">
                  {specialties.find((s: any) => s.id === editingFeeConfig.specialtyId)?.name || 'Unknown Specialty'}
                </div>
              ) : (
                <Select
                  value={selectedSpecialtyId}
                  onValueChange={setSelectedSpecialtyId}
                >
                  <SelectTrigger className="w-full border-slate-200 focus:ring-teal-500">
                    <SelectValue placeholder="Select a Specialty" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto bg-white border border-slate-200 shadow-md">
                    {specialties
                      .filter((s: any) => !homeVisitFees.some((f: any) => f.specialtyId === s.id))
                      .map((spec: any) => (
                        <SelectItem key={spec.id} value={spec.id} className="cursor-pointer hover:bg-slate-50">
                          {spec.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-fee" className="text-sm font-semibold text-slate-700">Consultation Fee (INR)</Label>
              <div className="relative">
                <Input
                  id="override-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={overrideFee}
                  onChange={(e) => setOverrideFee(e.target.value)}
                  className="pl-8 border-slate-200 focus-visible:ring-teal-500"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-commission" className="text-sm font-semibold text-slate-700">Platform Commission (%)</Label>
              <div className="relative">
                <Input
                  id="override-commission"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={overrideCommission}
                  onChange={(e) => setOverrideCommission(e.target.value)}
                  className="pl-8 border-slate-200 focus-visible:ring-teal-500"
                  placeholder="10.0"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  <Percent className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-row justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveOverride}
              disabled={savingOverride}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-transform active:scale-[0.98]"
            >
              {savingOverride ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingFeeConfig ? 'Update Override' : 'Create Override'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
