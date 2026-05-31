'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Building2,
  Table as TableIcon,
  Eye,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/app/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/app/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/app/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api/httpClient';

export default function DoctorFeesPage() {
  const [fees, setFees] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [filterHospital, setFilterHospital] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formState, setFormState] = useState({
    hospitalId: null as string | null,
    specialtyId: '',
    procedureId: null as string | null,
    procedureTypeId: null as string | null,
    roomTypeId: '',
    fee: '',
    discountPercentage: '0',
    notes: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const urls = [
        '/api/doctors/fees/mrp',
        '/api/doctors/specialties',
        '/api/room-types',
        '/api/hospitals'
      ];
      
      const results = await Promise.allSettled(urls.map(url => apiClient.get(url)));
      
      const [feesRes, specsRes, roomsRes, hospRes] = results;

      if (feesRes.status === 'fulfilled' && feesRes.value.data.success) setFees(feesRes.value.data.data);
      if (specsRes.status === 'fulfilled' && specsRes.value.data.success) setSpecialties(specsRes.value.data.data);
      if (roomsRes.status === 'fulfilled' && roomsRes.value.data.success) setRoomTypes(roomsRes.value.data.data);
      if (hospRes.status === 'fulfilled' && hospRes.value.data.success) {
        setHospitals(hospRes.value.data.data);
      } else {
        console.error('Hospitals fetch failed or returned error');
      }
    } catch (error) {
      console.error('Error in fetchInitialData:', error);
      toast.error('Failed to load some dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const filteredFees = useMemo(() => {
    return fees.filter(fee => {
      const specialtyMatch = selectedSpecialty === 'all' || fee.specialtyId === selectedSpecialty;
      const hospitalMatch = 
        filterHospital === 'all' ? true :
        filterHospital === 'mrp' ? !fee.hospitalId :
        fee.hospitalId === filterHospital;
      
      const searchLower = searchQuery.toLowerCase();
      const searchMatch = !searchQuery || 
        fee.procedureName?.toLowerCase().includes(searchLower) ||
        fee.specialtyName?.toLowerCase().includes(searchLower) ||
        fee.hospitalName?.toLowerCase().includes(searchLower);
      
      return specialtyMatch && hospitalMatch && searchMatch;
    });
  }, [fees, selectedSpecialty, filterHospital, searchQuery]);

  const handleHospitalChange = (value: string) => {
    const hospitalId = value === 'none' ? null : value;
    setFormState(prev => ({ ...prev, hospitalId }));
  };

  // Reactive pre-fill from Global MRP
  useEffect(() => {
    // Only pre-fill if it's a hospital proposal and we're not currently editing an existing one
    // and if the fee field is currently empty (to avoid overwriting manual changes)
    if (formState.hospitalId && formState.specialtyId && formState.roomTypeId && !editingFee && !formState.fee) {
      const mrpMatch = fees.find(f => 
        !f.hospitalId && 
        f.specialtyId === formState.specialtyId &&
        f.procedureId === formState.procedureId &&
        f.procedureTypeId === formState.procedureTypeId &&
        f.roomTypeId === formState.roomTypeId
      );

      if (mrpMatch) {
        setFormState(prev => ({
          ...prev,
          fee: mrpMatch.fee,
          discountPercentage: mrpMatch.discountPercentage,
          notes: mrpMatch.notes || '',
        }));
        toast.info('Prefilled from your Global MRP baseline');
      }
    }
  }, [formState.hospitalId, formState.specialtyId, formState.roomTypeId, formState.procedureId, formState.procedureTypeId, fees, editingFee]);

  const handleBulkPropose = async () => {
    if (!formState.hospitalId || !formState.specialtyId || saving) return;
    
    setSaving(true);
    try {
      const res = await apiClient.post('/api/doctors/fees/bulk-propose', {
        hospitalId: formState.hospitalId,
        specialtyId: formState.specialtyId,
      });
      
      if (res.data.success) {
        toast.success(`Success! Proposed ${res.data.count} fees to this hospital from your MRPs.`);
        setIsModalOpen(false);
        fetchInitialData();
      } else {
        toast.error(res.data.message || 'Bulk proposal failed');
      }
    } catch (error: any) {
      console.error('Bulk proposal error:', error);
      toast.error(error.response?.data?.message || 'Error occurred during bulk propose');
    } finally {
      setSaving(false);
    }
  };

  const handleSpecialtyChange = async (value: string) => {
    setFormState(prev => ({ 
      ...prev, 
      specialtyId: value, 
      procedureId: null, 
      procedureTypeId: null 
    }));
    setProcedures([]);
    setProcedureTypes([]);

    if (value && value !== 'all') {
      try {
        const res = await apiClient.get(`/api/admin/procedures?specialtyId=${value}`);
        if (res.data.success) setProcedures(res.data.data);
      } catch (error) {
        console.error('Error fetching procedures:', error);
      }
    }
  };

  const handleProcedureChange = async (value: string) => {
    const procedureId = value === 'none' ? null : value;
    setFormState(prev => ({ ...prev, procedureId, procedureTypeId: null }));
    setProcedureTypes([]);

    if (procedureId) {
      try {
        const res = await apiClient.get(`/api/admin/procedures/types?procedureId=${procedureId}`);
        if (res.data.success) setProcedureTypes(res.data.data);
      } catch (error) {
        console.error('Error fetching procedure types:', error);
      }
    }
  };

  const handleSaveFee = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        ...formState,
        status: 'pending', // Explicitly set to pending
      };

      const res = await apiClient.post('/api/doctors/fees/mrp', payload);
      if (res.data.success) {
        toast.success(editingFee ? 'Fee update submitted' : 'New fee proposal saved');
        setIsModalOpen(false);
        fetchInitialData();
        resetForm();
      } else {
        toast.error(res.data.message || 'Failed to save fee');
      }
    } catch (error) {
      console.error('Error saving fee:', error);
      toast.error('Internal server error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fee?')) return;
    try {
      const res = await apiClient.delete(`/api/doctors/fees/mrp?id=${id}`);
      if (res.data.success) {
        toast.success('Fee deleted');
        fetchInitialData();
      }
    } catch (error) {
      toast.error('Failed to delete fee');
    }
  };

  const resetForm = (initialHospitalId?: string | null) => {
    setFormState({
      hospitalId: initialHospitalId !== undefined ? initialHospitalId : null,
      specialtyId: '',
      procedureId: null,
      procedureTypeId: null,
      roomTypeId: '',
      fee: '',
      discountPercentage: '0',
      notes: '',
    });
    setEditingFee(null);
    setProcedures([]);
    setProcedureTypes([]);
  };

  const handleEdit = (fee: any) => {
    setEditingFee(fee);
    setFormState({
      hospitalId: fee.hospitalId || null,
      specialtyId: fee.specialtyId,
      procedureId: fee.procedureId || null,
      procedureTypeId: fee.procedureTypeId || null,
      roomTypeId: fee.roomTypeId,
      fee: fee.fee,
      discountPercentage: fee.discountPercentage,
      notes: fee.notes || '',
    });
    
    // Load procedures/types for the modal
    if (fee.specialtyId) {
      apiClient.get(`/api/admin/procedures?specialtyId=${fee.specialtyId}`)
        .then(res => { if (res.data.success) setProcedures(res.data.data); });
    }
    if (fee.procedureId) {
      apiClient.get(`/api/admin/procedures/types?procedureId=${fee.procedureId}`)
        .then(res => { if (res.data.success) setProcedureTypes(res.data.data); });
    }
    
    setIsModalOpen(true);
  };

  const isLocked = !!editingFee?.hospitalId && editingFee?.status === 'approved';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee Management</h1>
          <p className="text-muted-foreground">Propose global MRPs and hospital-specific custom pricing.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 h-4 w-4" /> Add New Fee <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Choose Price Scope</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { resetForm(null); setIsModalOpen(true); }} className="cursor-pointer">
              <TableIcon className="mr-2 h-4 w-4 text-slate-500" />
              <span>Add Global MRP</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => { 
                const firstHosp = hospitals.length > 0 ? hospitals[0].id : null;
                resetForm(firstHosp); 
                setIsModalOpen(true); 
              }} 
              className="cursor-pointer"
            >
              <Building2 className="mr-2 h-4 w-4 text-blue-500" />
              <span>Add Hospital Proposal</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search specialties or procedures..."
            className="pl-10 bg-muted/50 border-none focus-visible:ring-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
            <SelectTrigger className="w-full md:w-48 bg-muted/50 border-none">
              <SelectValue placeholder="All Specialties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterHospital} onValueChange={setFilterHospital}>
            <SelectTrigger className="w-full md:w-48 bg-muted/50 border-none">
              <SelectValue placeholder="Filter by Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Global + Hospital</SelectItem>
              <SelectItem value="mrp">Global MRP Only</SelectItem>
              {hospitals.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Specialty</TableHead>
                <TableHead>Procedure</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Room Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Fee (₹)</TableHead>
                <TableHead>Disc %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p>Loading your pricing records...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredFees.length > 0 ? (
                filteredFees.map((fee) => (
                  <TableRow key={fee.id} className="hover:bg-muted/30 transition-colors group">
                    <TableCell className="font-semibold">{fee.specialtyName}</TableCell>
                    <TableCell>{fee.procedureName || <span className="text-muted-foreground text-xs italic">Default</span>}</TableCell>
                    <TableCell>{fee.procedureTypeName || <span className="text-muted-foreground text-xs">All Types</span>}</TableCell>
                    <TableCell>{fee.roomTypeName}</TableCell>
                    <TableCell>
                      {fee.hospitalId ? (
                        <div className="flex items-center text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md w-fit">
                          <Building2 className="mr-1.5 h-3 w-3" />
                          {fee.hospitalName || 'Hospital'}
                        </div>
                      ) : (
                        <div className="flex items-center text-slate-600 italic bg-slate-50 px-2 py-1 rounded-md w-fit">
                          <TableIcon className="mr-1.5 h-3 w-3" />
                          Global MRP
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{parseFloat(fee.fee).toLocaleString()}</TableCell>
                    <TableCell>{fee.discountPercentage}%</TableCell>
                    <TableCell>
                      {fee.hospitalId ? (
                        <Badge variant={fee.status === 'approved' ? 'default' : fee.status === 'rejected' ? 'destructive' : 'outline'} className="capitalize">
                          {fee.status || 'pending'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(fee.hospitalId && fee.status === 'approved') ? (
                        <Button variant="ghost" size="icon" title="View Locked Fee" onClick={() => handleEdit(fee)}>
                          <Eye className="h-4 w-4 text-blue-500" />
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(fee)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(fee.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
                      <p>No pricing records match your current filters.</p>
                      <Button variant="link" onClick={() => {setFilterHospital('all'); setSelectedSpecialty('all'); setSearchQuery('');}}>
                        Clear all filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isLocked ? <Eye className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-primary" />}
              {isLocked ? 'View Approved Fee' : (editingFee ? 'Edit Fee Proposal' : 'Add New Fee Proposal')}
            </DialogTitle>
            <DialogDescription>
              {isLocked 
                ? 'This fee is approved and locked. To change it, please contact the hospital.' 
                : 'Set your global baseline price or propose a custom rate for a specific hospital.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="hospital" className="text-sm font-bold text-blue-600 flex items-center">
                <Building2 className="mr-1.5 h-4 w-4" />
                Select Hospital (or Global MRP)
              </Label>
              <Select 
                value={formState.hospitalId || 'none'} 
                onValueChange={handleHospitalChange}
                disabled={isLocked || !!editingFee}
              >
                <SelectTrigger className="h-11 border-blue-100 bg-blue-50/10">
                  <SelectValue placeholder="Choose a hospital or Global MRP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="font-semibold text-slate-700 italic">
                    <div className="flex items-center">
                      <TableIcon className="mr-2 h-4 w-4" /> Global MRP (Baseline)
                    </div>
                  </SelectItem>
                  {hospitals.map(h => (
                    <SelectItem key={h.id} value={h.id} className="font-medium">
                      <div className="flex items-center">
                        <Building2 className="mr-2 h-4 w-4" /> {h.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Proposing a fee for a hospital will NOT change your Global MRP baseline.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="specialty" className="text-sm font-bold">Specialty</Label>
                <Select 
                  value={formState.specialtyId} 
                  onValueChange={handleSpecialtyChange}
                  disabled={isLocked || !!editingFee}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select Specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formState.hospitalId && formState.specialtyId && !editingFee && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 text-[10px] h-7 gap-1 border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-100"
                    onClick={handleBulkPropose}
                    disabled={saving}
                  >
                    <Plus className="h-3 w-3" /> Sync all Global MRPs for this Specialty
                  </Button>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="room" className="text-sm font-bold">Room Type</Label>
                <Select 
                  value={formState.roomTypeId} 
                  onValueChange={(v) => setFormState(s => ({ ...s, roomTypeId: v }))}
                  disabled={isLocked}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select Room" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.displayName || r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="procedure" className="text-sm font-bold">Procedure (Optional)</Label>
                <Select 
                  value={formState.procedureId || 'none'} 
                  onValueChange={handleProcedureChange}
                  disabled={isLocked || !formState.specialtyId || !!editingFee}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select Procedure (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Entire Specialty (Default)</SelectItem>
                    {procedures.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type" className="text-sm font-bold">Procedure Type (Optional)</Label>
                <Select 
                  value={formState.procedureTypeId || 'none'} 
                  onValueChange={(v) => setFormState(s => ({ ...s, procedureTypeId: v === 'none' ? null : v }))}
                  disabled={isLocked || !formState.procedureId || procedureTypes.length === 0}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standard / All Types</SelectItem>
                    {procedureTypes.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.displayName || t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2">
              <div className="grid gap-2">
                <Label htmlFor="fee" className="text-sm font-bold text-primary">Proposed Fee (₹)</Label>
                <Input
                  id="fee"
                  type="number"
                  placeholder="0.00"
                  value={formState.fee}
                  onChange={(e) => setFormState(s => ({ ...s, fee: e.target.value }))}
                  disabled={isLocked}
                  className="h-11 text-lg font-semibold"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discount" className="text-sm font-bold">Discount (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  placeholder="0"
                  value={formState.discountPercentage}
                  onChange={(e) => setFormState(s => ({ ...s, discountPercentage: e.target.value }))}
                  disabled={isLocked}
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes" className="text-sm font-bold">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Reason for custom pricing..."
                value={formState.notes}
                onChange={(e) => setFormState(s => ({ ...s, notes: e.target.value }))}
                disabled={isLocked}
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-6 gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {isLocked ? 'Close' : 'Cancel'}
            </Button>
            {!isLocked && (
              <Button onClick={handleSaveFee} disabled={saving || !formState.specialtyId || !formState.roomTypeId || !formState.fee}>
                {saving ? 'Submitting Proposal...' : (editingFee ? 'Update Proposal' : 'Submit Proposal')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
