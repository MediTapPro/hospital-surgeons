'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Edit, Trash2, Loader2, List, Layers, Tag as TagIcon } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface Specialty {
  id: string;
  name: string;
  description: string | null;
}

interface Category {
  id: string;
  specialtyId: string;
  name: string;
  description: string | null;
}

interface Procedure {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  specialtyId: string;
  specialtyName?: string;
  categoryId: string | null;
  categoryName?: string;
}

interface ProcedureType {
  id: string;
  name: string;
  displayName: string;
}

interface ProceduresManagementProps {
  specialtyId?: string;
  specialtyName?: string;
  hideHeader?: boolean;
  readOnly?: boolean;
  defaultTab?: string;
}

export function ProceduresManagement({ specialtyId, specialtyName, hideHeader = false, readOnly = false, defaultTab = 'specialty' }: ProceduresManagementProps) {
  const [activeTab, setActiveTab] = useState(defaultTab === 'details' ? 'specialty' : defaultTab);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [specialties, setSpecialties] = useState<Specialty[]>(
    specialtyId ? [{ id: specialtyId, name: specialtyName || '', description: '', status: 'Active' } as any] : []
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  
  // View modes
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form Data
  const [procedureForm, setProcedureForm] = useState<{
    name: string;
    description: string;
    specialtyId: string;
    categoryId: string;
    typeIds: string[];
  }>({
    name: '',
    description: '',
    specialtyId: specialtyId || '',
    categoryId: '',
    typeIds: [],
  });
  
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    specialtyId: specialtyId || '',
  });
  
  const [specialtyForm, setSpecialtyForm] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, [specialtyId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSpecialties(),
        fetchCategories(),
        fetchProcedures(),
        fetchProcedureTypes()
      ]);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    if (specialtyId) {
      try {
        const res = await fetch(`/api/admin/specialties/${specialtyId}`);
        const data = await res.json();
        if (data.success) {
          setSpecialties([data.data]);
          // Sync specialty form
          setSpecialtyForm({
            name: data.data.name,
            description: data.data.description || '',
          });
        }
      } catch (error) {
        console.error('Error fetching specialty details:', error);
      }
      return;
    }
    const res = await fetch('/api/admin/specialties?limit=100');
    const data = await res.json();
    if (data.success) setSpecialties(data.data);
  };

  const fetchCategories = async () => {
    const url = specialtyId 
      ? `/api/admin/procedures/categories?specialtyId=${specialtyId}` 
      : '/api/admin/procedures/categories';
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) setCategories(data.data);
  };

  const fetchProcedures = async () => {
    const url = specialtyId 
      ? `/api/admin/procedures?specialtyId=${specialtyId}` 
      : '/api/admin/procedures';
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) setProcedures(data.data);
  };

  const fetchProcedureTypes = async () => {
    const res = await fetch('/api/admin/procedures/types');
    const data = await res.json();
    if (data.success) setProcedureTypes(data.data);
  };

  const handleOpenForm = async (item?: any) => {
    if (item) {
      setEditingItem(item);
      if (item.type === 'specialty') {
        setActiveTab('specialty');
        setSpecialtyForm({
          name: item.name,
          description: item.description || '',
        });
      } else if (activeTab === 'categories' || item.specialtyId && !item.categoryId) {
        setCategoryForm({
          name: item.name,
          description: item.description || '',
          specialtyId: item.specialtyId,
        });
      } else {
        // Need to fetch full procedure info to get typeIds when editing
        const res = await fetch(`/api/admin/procedures/${item.id}`);
        const data = await res.json();
        const fullItem = data.success ? data.data : item;
        setProcedureForm({
          name: fullItem.name || item.name,
          description: fullItem.description || item.description || '',
          specialtyId: fullItem.specialtyId || item.specialtyId,
          categoryId: fullItem.categoryId || item.categoryId || '',
          typeIds: fullItem.typeIds || [],
        });
      }
    } else {
      setEditingItem(null);
      if (activeTab === 'categories') {
        setCategoryForm({ name: '', description: '', specialtyId: specialtyId || '' });
      } else if (activeTab === 'procedures') {
        setProcedureForm({ name: '', description: '', specialtyId: specialtyId || '', categoryId: '', typeIds: [] });
      } else if (activeTab === 'specialty') {
          // Editing current specialty
          const current = specialties.find(s => s.id === specialtyId);
          if (current) {
               setEditingItem({ ...current, type: 'specialty' });
               setSpecialtyForm({ name: current.name, description: current.description || '' });
          }
      }
    }
    setViewMode('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let url = '';
      let method = editingItem ? 'PUT' : 'POST';
      let body = {};

      if (editingItem?.type === 'specialty') {
        url = `/api/admin/specialties/${editingItem.id}`;
        body = specialtyForm;
      } else if (activeTab === 'categories') {
        url = editingItem ? `/api/admin/procedures/categories/${editingItem.id}` : '/api/admin/procedures/categories';
        body = categoryForm;
      } else {
        url = editingItem ? `/api/admin/procedures/${editingItem.id}` : '/api/admin/procedures';
        body = procedureForm;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${editingItem?.type === 'specialty' ? 'Specialty' : activeTab.slice(0, -1)} ${editingItem ? 'updated' : 'created'}`);
        if (editingItem?.type === 'specialty') {
            fetchSpecialties();
        } else if (activeTab === 'categories') {
          fetchCategories();
        } else {
          fetchProcedures();
        }
        setViewMode('list');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setSubmitting(false);
    }
  };


  // Replaces handleQuickCategoryCreate

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    let url = '';
    if (activeTab === 'procedures') url = `/api/admin/procedures/${id}`;
    else if (activeTab === 'categories') url = `/api/admin/procedures/categories/${id}`;
    
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchInitialData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Deletion failed');
    }
  };

  const displaySpecialtyName = specialtyName || specialties.find(s => s.id === specialtyId)?.name || 'Specialty';

  return (
    <div className={hideHeader ? "" : "min-h-screen bg-slate-50"}>
      {!hideHeader && (
        <PageHeader 
          title="Procedures Hierarchy" 
          description="Manage medical procedures and therapeutic categories"
          actions={viewMode === 'list' && !readOnly && (
            <Button onClick={() => handleOpenForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Add {activeTab.slice(0, -1)}
            </Button>
          )}
        />
      )}

      <div className={hideHeader ? "" : "p-8"}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className={`bg-white rounded-lg ${hideHeader ? "" : "shadow min-h-[600px]"}`}>
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <TabsList className="bg-slate-100 p-1 mb-8">
              <TabsTrigger value="specialty" className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm px-8 py-2.5 rounded-md transition-all">
                <TagIcon className="w-4 h-4 mr-2" />
                Specialty
              </TabsTrigger>
                <TabsTrigger value="categories" className="data-[state=active]:bg-white" disabled={viewMode === 'form'}>
                  <Layers className="w-4 h-4 mr-2" />
                  Categories
                </TabsTrigger>
                <TabsTrigger value="procedures" className="data-[state=active]:bg-white" disabled={viewMode === 'form'}>
                  <List className="w-4 h-4 mr-2" />
                  Procedures
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {viewMode === 'list' ? (
                <>
                  {!readOnly && (
                    <div className="relative flex-1 min-w-[200px] sm:w-64 sm:flex-initial">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input placeholder="Search..." className="pl-9 h-9 w-full" />
                    </div>
                  )}
                  {hideHeader && !readOnly && (
                    <Button size="sm" onClick={() => handleOpenForm()} className="whitespace-nowrap px-3 shadow-sm border border-slate-200">
                      <Plus className="w-4 h-4 mr-1 ml-0" />
                      Add {activeTab.slice(0, -1)}
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setViewMode('list')} className="text-slate-600 shadow-sm bg-slate-50/50 border-slate-200">
                  Cancel & Return to List
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="specialty" className="p-0 animate-in fade-in-50">
            {viewMode === 'list' ? (
              <Table 
                headers={['Specialty', 'Description', 'Status', 'Actions']}
                loading={loading}
                items={specialties.filter(s => s.id === specialtyId)}
                renderRow={(item: Specialty) => (
                  <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{item.description || '-'}</td>
                    <td className="px-6 py-4">
                        <StatusBadge status="Active" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenForm({ ...item, type: 'specialty' })}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              />
            ) : (
                <div className="p-12 flex justify-center bg-slate-50/30">
                <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-lg border border-slate-100">
                    <HierarchyForm 
                        activeTab={activeTab}
                        editingItem={editingItem}
                        submitting={submitting}
                        specialties={specialties}
                        categories={categories}
                        onSubmit={handleSubmit}
                        procedureForm={procedureForm}
                        setProcedureForm={setProcedureForm}
                        categoryForm={categoryForm}
                        setCategoryForm={setCategoryForm}
                        specialtyForm={specialtyForm}
                        setSpecialtyForm={setSpecialtyForm}
                        specialtyId={specialtyId}
                        onCategoriesUpdate={fetchCategories}
                        onClose={() => setViewMode('list')}
                    />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="p-0 animate-in fade-in-50">
            {viewMode === 'list' ? (
              <Table 
                headers={[
                  'Category', 
                  ...(specialtyId ? [] : ['Specialty']), 
                  'Description', 
                  'Actions'
                ]}
                loading={loading}
                items={categories}
                renderRow={(item: Category) => (
                  <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                    {!specialtyId && (
                      <td className="px-6 py-4 text-slate-600">
                        {specialties.find(s => s.id === item.specialtyId)?.name || 'Unknown'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{item.description || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenForm(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              />
            ) : (
                <div className="p-12 flex justify-center bg-slate-50/30">
                <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-lg border border-slate-100">
                    <HierarchyForm 
                        activeTab={activeTab}
                        editingItem={editingItem}
                        submitting={submitting}
                        specialties={specialties}
                        categories={categories}
                        onSubmit={handleSubmit}
                        procedureForm={procedureForm}
                        setProcedureForm={setProcedureForm}
                        categoryForm={categoryForm}
                        setCategoryForm={setCategoryForm}
                        specialtyId={specialtyId}
                        onCategoriesUpdate={fetchCategories}
                        onClose={() => setViewMode('list')}
                    />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="procedures" className="p-0 animate-in fade-in-50">
            {viewMode === 'list' ? (
                <Table 
                headers={[
                    'Procedure', 
                    ...(specialtyId ? [] : ['Specialty']), 
                    'Category', 
                    'Status', 
                    'Actions'
                ]}
                loading={loading}
                items={procedures}
                renderRow={(item: Procedure) => (
                    <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                    {!specialtyId && <td className="px-6 py-4 text-slate-600">{item.specialtyName}</td>}
                    <td className="px-6 py-4 text-slate-600">{item.categoryName || '-'}</td>
                    <td className="px-6 py-4">
                        <StatusBadge status={item.isActive ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleOpenForm(item)}>
                                <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                        </div>
                    </td>
                    </tr>
                )}
                />
            ) : (
                <div className="p-12 flex justify-center bg-slate-50/30">
                <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-lg border border-slate-100">
                    <HierarchyForm 
                        activeTab={activeTab}
                        editingItem={editingItem}
                        submitting={submitting}
                        specialties={specialties}
                        categories={categories}
                        onSubmit={handleSubmit}
                        procedureForm={procedureForm}
                        setProcedureForm={setProcedureForm}
                        categoryForm={categoryForm}
                        setCategoryForm={setCategoryForm}
                        specialtyId={specialtyId}
                        onCategoriesUpdate={fetchCategories}
                        onClose={() => setViewMode('list')}
                        specialtyForm={specialtyForm}
                        setSpecialtyForm={setSpecialtyForm}
                        procedureTypes={procedureTypes}
                    />
                </div>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

    </div>
  );
}

function Table({ headers, loading, items, renderRow }: any) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-navy-600" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {headers.map((h: string) => (
              <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-6 py-12 text-center text-slate-400">No items found</td>
            </tr>
          ) : (
            items.map(renderRow)
          )}
        </tbody>
      </table>
    </div>
  );
}

function HierarchyForm({ 
  activeTab, editingItem, submitting, onSubmit,
  specialties, categories,
  procedureForm, setProcedureForm,
  categoryForm, setCategoryForm,
  specialtyForm, setSpecialtyForm,
  specialtyId,
  onCategoriesUpdate,
  onClose,
  procedureTypes
}: any) {
  const [showQuickAddCat, setShowQuickAddCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');

  const handleQuickAddCategory = async () => {
    if (!quickCatName.trim()) return;
    try {
      const res = await fetch('/api/admin/procedures/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickCatName,
          specialtyId: specialtyId || procedureForm.specialtyId
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Category created');
        setQuickCatName('');
        setShowQuickAddCat(false);
        if (onCategoriesUpdate) onCategoriesUpdate();
        setProcedureForm({ ...procedureForm, categoryId: data.data.id });
      }
    } catch (error) {
      toast.error('Failed to create category');
    }
  };

  return (
    <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            {editingItem ? 'Edit' : 'Add New'} {activeTab === 'specialty' ? 'Specialty Info' : activeTab.slice(0, -1)}
          </h3>
          <p className="text-sm text-slate-500">Fill in the details below to save your changes.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 pt-2">
          {activeTab === 'specialty' && (
              <>
                <div className="space-y-2">
                    <Label>Specialty *</Label>
                    <Input 
                        value={specialtyForm.name}
                        onChange={(e) => setSpecialtyForm({...specialtyForm, name: e.target.value})}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                        value={specialtyForm.description}
                        onChange={(e) => setSpecialtyForm({...specialtyForm, description: e.target.value})}
                        rows={4}
                    />
                </div>
              </>
          )}

          {activeTab === 'procedures' && (
             <>
             {!specialtyId && (
               <div className="space-y-2">
                 <Label>Specialty</Label>
                 <Select value={procedureForm.specialtyId} onValueChange={(v) => setProcedureForm({ ...procedureForm, specialtyId: v })}>
                   <SelectTrigger><SelectValue placeholder="Select Specialty" /></SelectTrigger>
                   <SelectContent className='bg-white'>
                     {specialties.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
             )}
             <div className="space-y-2">
               <div className="flex justify-between items-center">
                 <Label>Category</Label>
                 <Button 
                   type="button" 
                   variant="link" 
                   size="sm" 
                   className="h-auto p-0"
                   onClick={() => setShowQuickAddCat(!showQuickAddCat)}
                 >
                   {showQuickAddCat ? 'Select Existing' : '+ Add New'}
                 </Button>
               </div>
               
               {showQuickAddCat ? (
                 <div className="flex gap-2">
                   <input 
                     className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                     placeholder="New category name" 
                     value={quickCatName} 
                     onChange={(e) => setQuickCatName(e.target.value)}
                   />
                   <Button type="button" onClick={handleQuickAddCategory} size="sm">Add</Button>
                 </div>
               ) : (
                 <Select value={procedureForm.categoryId} onValueChange={(v) => setProcedureForm({ ...procedureForm, categoryId: v })}>
                   <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                   <SelectContent className='bg-white'> 
                     {categories
                       .filter((c: any) => c.specialtyId === (specialtyId || procedureForm.specialtyId))
                       .map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                     }
                   </SelectContent>
                 </Select>
               )}
             </div>
             <div className="space-y-2">
               <Label>Procedure Name</Label>
               <Input value={procedureForm.name} onChange={(e) => setProcedureForm({ ...procedureForm, name: e.target.value })} required />
             </div>
             <div className="space-y-2 mt-4 mb-4">
                <Label>Required Procedure Types (Pricing Options)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-slate-50 border border-slate-100 rounded-md">
                  {procedureTypes?.map((pt: any) => (
                    <label key={pt.id} className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={procedureForm.typeIds.includes(pt.id)}
                        onChange={(e) => {
                          const newTypeIds = e.target.checked 
                            ? [...procedureForm.typeIds, pt.id]
                            : procedureForm.typeIds.filter((id: string) => id !== pt.id);
                          setProcedureForm({...procedureForm, typeIds: newTypeIds});
                        }}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-slate-700">{pt.displayName}</span>
                    </label>
                  ))}
                  {(!procedureTypes || procedureTypes.length === 0) && (
                    <div className="text-sm text-slate-500 col-span-2">No procedure types found. Please seed them.</div>
                  )}
                </div>
              </div>
             <div className="space-y-2">
               <Label>Description</Label>
               <Textarea value={procedureForm.description} onChange={(e) => setProcedureForm({ ...procedureForm, description: e.target.value })} />
             </div>
           </>
          )}

          {activeTab === 'categories' && (
            <>
              {!specialtyId && (
                <div className="space-y-2">
                  <Label>Specialty</Label>
                  <Select value={categoryForm.specialtyId} onValueChange={(v) => setCategoryForm({ ...categoryForm, specialtyId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Specialty" /></SelectTrigger>
                    <SelectContent className='bg-white'>
                      {specialties.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="shadow-sm border-slate-200 bg-slate-50/50 text-slate-600">
                Cancel
            </Button>
            <Button type="submit" className="min-w-[100px] shadow-sm" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingItem ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
    </div>
  );
}
