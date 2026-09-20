'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Edit, Trash2, Loader2, List, Layers, Tag as TagIcon } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
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
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import apiClient from '@/lib/api/httpClient';
import { AdminDataTable, type AdminDataTableColumn } from '../ui/AdminDataTable';

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

interface DeleteTarget {
  id: string;
  name: string;
  kind: 'procedure' | 'category';
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
  const [search, setSearch] = useState('');

  // Data
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);

  // View modes
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        fetchCategories(''),
        fetchCategoryOptions(),
        fetchProcedures(''),
        fetchProcedureTypes(),
      ]);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const response = specialtyId
        ? await apiClient.get(`/api/admin/specialties/${specialtyId}`)
        : await apiClient.get('/api/admin/specialties?limit=100');

      const data = response.data;
      if (!data.success) return;

      if (specialtyId) {
        setSpecialties([data.data]);
        setSpecialtyForm({
          name: data.data.name,
          description: data.data.description || '',
        });
        return;
      }

      setSpecialties(data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch specialties');
    }
  };

  const fetchCategories = async (searchTerm: string) => {
    try {
      const params = new URLSearchParams();
      if (specialtyId) params.append('specialtyId', specialtyId);
      if (searchTerm) params.append('search', searchTerm);

      const query = params.size ? `?${params.toString()}` : '';
      const response = await apiClient.get(`/api/admin/procedures/categories${query}`);
      if (response.data.success) setCategories(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch categories');
    }
  };

  const fetchProcedures = async (searchTerm: string) => {
    try {
      const params = new URLSearchParams();
      if (specialtyId) params.append('specialtyId', specialtyId);
      if (searchTerm) params.append('search', searchTerm);

      const query = params.size ? `?${params.toString()}` : '';
      const response = await apiClient.get(`/api/admin/procedures${query}`);
      if (response.data.success) setProcedures(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch procedures');
    }
  };

  const fetchProcedureTypes = async () => {
    try {
      const response = await apiClient.get('/api/admin/procedures/types');
      if (response.data.success) setProcedureTypes(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch procedure types');
    }
  };

  /**
   * The category dropdown in the procedure form must always offer every category for the
   * specialty, so it is fed from an unfiltered list rather than the search-filtered table list.
   */
  const fetchCategoryOptions = async () => {
    try {
      const params = new URLSearchParams();
      if (specialtyId) params.append('specialtyId', specialtyId);

      const query = params.size ? `?${params.toString()}` : '';
      const response = await apiClient.get(`/api/admin/procedures/categories${query}`);
      if (response.data.success) setCategoryOptions(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch categories');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    fetchCategories(value);
    fetchProcedures(value);
  };

  const refreshLists = async () => {
    await Promise.all([
      fetchSpecialties(),
      fetchCategories(search),
      fetchCategoryOptions(),
      fetchProcedures(search),
    ]);
  };

  const handleCategoriesChanged = async () => {
    await Promise.all([fetchCategories(search), fetchCategoryOptions()]);
  };

  const handleOpenForm = async (item?: any) => {
    if (!item) {
      setEditingItem(null);
      if (activeTab === 'categories') {
        setCategoryForm({ name: '', description: '', specialtyId: specialtyId || '' });
      } else if (activeTab === 'procedures') {
        setProcedureForm({ name: '', description: '', specialtyId: specialtyId || '', categoryId: '', typeIds: [] });
      } else {
        // Editing the current specialty
        const current = specialties.find(s => s.id === specialtyId);
        if (current) {
          setEditingItem({ ...current, type: 'specialty' });
          setSpecialtyForm({ name: current.name, description: current.description || '' });
        }
      }
      setViewMode('form');
      return;
    }

    setEditingItem(item);

    if (item.type === 'specialty') {
      setActiveTab('specialty');
      setSpecialtyForm({ name: item.name, description: item.description || '' });
    } else if (activeTab === 'categories') {
      setCategoryForm({
        name: item.name,
        description: item.description || '',
        specialtyId: item.specialtyId,
      });
    } else {
      // Need the full procedure to get its typeIds when editing
      const response = await apiClient.get(`/api/admin/procedures/${item.id}`);
      const fullItem = response.data?.success ? response.data.data : item;
      setProcedureForm({
        name: fullItem.name || item.name,
        description: fullItem.description || item.description || '',
        specialtyId: fullItem.specialtyId || item.specialtyId,
        categoryId: fullItem.categoryId || item.categoryId || '',
        typeIds: fullItem.typeIds || [],
      });
    }

    setViewMode('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let response;

      if (editingItem?.type === 'specialty') {
        response = await apiClient.put(`/api/admin/specialties/${editingItem.id}`, specialtyForm);
      } else if (activeTab === 'categories') {
        response = editingItem
          ? await apiClient.put(`/api/admin/procedures/categories/${editingItem.id}`, categoryForm)
          : await apiClient.post('/api/admin/procedures/categories', categoryForm);
      } else {
        response = editingItem
          ? await apiClient.put(`/api/admin/procedures/${editingItem.id}`, procedureForm)
          : await apiClient.post('/api/admin/procedures', procedureForm);
      }

      const data = response.data;

      if (data.success) {
        const entityLabel = editingItem?.type === 'specialty' ? 'Specialty' : activeTab.slice(0, -1);
        toast.success(`${entityLabel} ${editingItem ? 'updated' : 'created'}`);
        await refreshLists();
        setViewMode('list');
      } else {
        toast.error(data.message || 'Failed to save');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const url = deleteTarget.kind === 'category'
        ? `/api/admin/procedures/categories/${deleteTarget.id}`
        : `/api/admin/procedures/${deleteTarget.id}`;

      const response = await apiClient.delete(url);
      const data = response.data;

      if (data.success) {
        toast.success(data.message || 'Deleted successfully');
        setDeleteTarget(null);
        await refreshLists();
      } else {
        toast.error(data.message || 'Deletion failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Deletion failed');
    } finally {
      setDeleting(false);
    }
  };

  const renderActions = (item: { id: string; name: string }, kind: 'procedure' | 'category') => {
    if (readOnly) {
      return <span className="block text-center text-slate-400">-</span>;
    }

    return (
      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
        <Button size="sm" variant="outline" onClick={() => handleOpenForm(item)} aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`} className="border-slate-200 text-slate-700 hover:bg-slate-50">
          <Edit className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDeleteTarget({ id: item.id, name: item.name, kind })}
          disabled={deleting && deleteTarget?.id === item.id}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          aria-label={`Delete ${item.name}`}
          title={`Delete ${item.name}`}
        >
          {deleting && deleteTarget?.id === item.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{deleting && deleteTarget?.id === item.id ? 'Deleting…' : 'Delete'}</span>
        </Button>
      </div>
    );
  };

  const specialtyColumns: AdminDataTableColumn<Specialty>[] = [
    {
      id: 'specialty',
      label: 'Specialty',
      widthClassName: 'w-[30%]',
      cell: (item) => <span className="font-medium text-slate-900">{item.name}</span>,
    },
    {
      id: 'description',
      label: 'Description',
      widthClassName: 'w-[46%]',
      cell: (item) => <span className="block truncate text-slate-600">{item.description || '-'}</span>,
    },
    {
      id: 'actions',
      label: 'Actions',
      widthClassName: 'w-[24%]',
      sticky: 'right',
      headerClassName: 'min-w-[120px]',
      cellClassName: 'min-w-[120px]',
      cell: (item) =>
        readOnly ? (
          <span className="block text-center text-slate-400">-</span>
        ) : (
          <div className="flex items-center justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenForm({ ...item, type: 'specialty' })}
              aria-label={`Edit ${item.name}`}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Edit className="w-4 h-4" />
              <span>Edit specialty</span>
            </Button>
          </div>
        ),
    },
  ];

  const categoryColumns: AdminDataTableColumn<Category>[] = [
    {
      id: 'category',
      label: 'Category',
      widthClassName: specialtyId ? 'w-[34%]' : 'w-[26%]',
      cell: (item) => <span className="font-medium text-slate-900">{item.name}</span>,
    },
    ...(specialtyId
      ? []
      : [{
          id: 'specialty',
          label: 'Specialty',
          widthClassName: 'w-[20%]',
          cell: (item: Category) => (
            <span className="text-slate-600">
              {specialties.find(s => s.id === item.specialtyId)?.name || 'Unknown'}
            </span>
          ),
        }]),
    {
      id: 'description',
      label: 'Description',
      widthClassName: specialtyId ? 'w-[42%]' : 'w-[30%]',
      cell: (item) => <span className="block truncate text-slate-600">{item.description || '-'}</span>,
    },
    {
      id: 'actions',
      label: 'Actions',
      widthClassName: 'w-[24%]',
      sticky: 'right',
      headerClassName: 'min-w-[120px]',
      cellClassName: 'min-w-[120px]',
      cell: (item) => renderActions(item, 'category'),
    },
  ];

  const procedureColumns: AdminDataTableColumn<Procedure>[] = [
    {
      id: 'procedure',
      label: 'Procedure',
      widthClassName: specialtyId ? 'w-[34%]' : 'w-[26%]',
      cell: (item) => <span className="font-medium text-slate-900">{item.name}</span>,
    },
    ...(specialtyId
      ? []
      : [{
          id: 'specialty',
          label: 'Specialty',
          widthClassName: 'w-[18%]',
          cell: (item: Procedure) => <span className="text-slate-600">{item.specialtyName}</span>,
        }]),
    {
      id: 'category',
      label: 'Category',
      widthClassName: 'w-[20%]',
      cell: (item) => <span className="text-slate-600">{item.categoryName || '-'}</span>,
    },
    {
      id: 'status',
      label: 'Status',
      widthClassName: 'w-[14%]',
      cell: (item) => <StatusBadge status={item.isActive ? 'Active' : 'Inactive'} />,
    },
    {
      id: 'actions',
      label: 'Actions',
      widthClassName: 'w-[24%]',
      sticky: 'right',
      headerClassName: 'min-w-[120px]',
      cellClassName: 'min-w-[120px]',
      cell: (item) => renderActions(item, 'procedure'),
    },
  ];

  const loadingBlock = (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-navy-600" />
    </div>
  );

  return (
    <div className={hideHeader ? '' : 'min-h-screen bg-slate-50'}>
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

      <div className={hideHeader ? '' : 'p-8'}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${hideHeader ? 'shadow-sm' : 'shadow-sm min-h-[600px]'}`}>
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <TabsList className="h-auto bg-slate-100 p-1">
                <TabsTrigger value="specialty" disabled={viewMode === 'form'} className="px-4 py-2 text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:px-6">
                  <TagIcon className="w-4 h-4 mr-2" />
                  Specialty
                </TabsTrigger>
                <TabsTrigger value="categories" disabled={viewMode === 'form'} className="px-4 py-2 text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                  <Layers className="w-4 h-4 mr-2" />
                  Categories
                </TabsTrigger>
                <TabsTrigger value="procedures" disabled={viewMode === 'form'} className="px-4 py-2 text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                  <List className="w-4 h-4 mr-2" />
                  Procedures
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {viewMode === 'list' ? (
                <>
                  <div className="relative flex-1 min-w-[200px] sm:w-64 sm:flex-initial">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="h-10 w-full border-slate-300 bg-white pl-9 shadow-sm"
                    />
                  </div>
                  {hideHeader && !readOnly && (
                  <Button size="sm" onClick={() => handleOpenForm()} className="whitespace-nowrap border border-teal-700 bg-teal-700 px-3 text-white shadow-sm hover:bg-teal-800">
                      <Plus className="w-4 h-4 mr-1 ml-0" />
                      Add {activeTab.slice(0, -1)}
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="hidden text-sm text-slate-500 sm:inline">Editing {activeTab === 'specialty' ? 'specialty' : activeTab}</span>
                  <Button variant="outline" size="sm" onClick={() => { setViewMode('list'); setEditingItem(null); }} className="border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          <TabsContent value="specialty" className="p-0 animate-in fade-in-50">
            {viewMode === 'list' ? (
              loading ? loadingBlock : (
                <AdminDataTable
                  columns={specialtyColumns}
                  data={specialties.filter(s => s.id === specialtyId)}
                  emptyMessage="No specialty found"
                  getRowKey={(item) => item.id}
                  minWidthClassName="min-w-[640px]"
                />
              )
            ) : (
              <div className="flex justify-center bg-slate-50/40 p-5 sm:p-10">
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <HierarchyForm
                    activeTab={activeTab}
                    editingItem={editingItem}
                    submitting={submitting}
                    specialties={specialties}
                    categories={categoryOptions}
                    onSubmit={handleSubmit}
                    procedureForm={procedureForm}
                    setProcedureForm={setProcedureForm}
                    categoryForm={categoryForm}
                    setCategoryForm={setCategoryForm}
                    specialtyForm={specialtyForm}
                    setSpecialtyForm={setSpecialtyForm}
                    specialtyId={specialtyId}
                    onCategoriesUpdate={handleCategoriesChanged}
                    onClose={() => setViewMode('list')}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="p-0 animate-in fade-in-50">
            {viewMode === 'list' ? (
              loading ? loadingBlock : (
                <AdminDataTable
                  columns={categoryColumns}
                  data={categories}
                  emptyMessage="No categories found"
                  getRowKey={(item) => item.id}
                  minWidthClassName={specialtyId ? 'min-w-[760px]' : 'min-w-[960px]'}
                />
              )
            ) : (
              <div className="flex justify-center bg-slate-50/40 p-5 sm:p-10">
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <HierarchyForm
                    activeTab={activeTab}
                    editingItem={editingItem}
                    submitting={submitting}
                    specialties={specialties}
                    categories={categoryOptions}
                    onSubmit={handleSubmit}
                    procedureForm={procedureForm}
                    setProcedureForm={setProcedureForm}
                    categoryForm={categoryForm}
                    setCategoryForm={setCategoryForm}
                    specialtyForm={specialtyForm}
                    setSpecialtyForm={setSpecialtyForm}
                    specialtyId={specialtyId}
                    onCategoriesUpdate={handleCategoriesChanged}
                    onClose={() => setViewMode('list')}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="procedures" className="p-0 animate-in fade-in-50">
            {viewMode === 'list' ? (
              loading ? loadingBlock : (
                <AdminDataTable
                  columns={procedureColumns}
                  data={procedures}
                  emptyMessage="No procedures found"
                  getRowKey={(item) => item.id}
                  minWidthClassName={specialtyId ? 'min-w-[900px]' : 'min-w-[1100px]'}
                />
              )
            ) : (
              <div className="flex justify-center bg-slate-50/40 p-5 sm:p-10">
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <HierarchyForm
                    activeTab={activeTab}
                    editingItem={editingItem}
                    submitting={submitting}
                    specialties={specialties}
                    categories={categoryOptions}
                    onSubmit={handleSubmit}
                    procedureForm={procedureForm}
                    setProcedureForm={setProcedureForm}
                    categoryForm={categoryForm}
                    setCategoryForm={setCategoryForm}
                    specialtyId={specialtyId}
                    onCategoriesUpdate={handleCategoriesChanged}
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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-md border-slate-200 bg-white p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.kind === 'category' ? 'category' : 'procedure'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ProcedureFormState {
  name: string;
  description: string;
  specialtyId: string;
  categoryId: string;
  typeIds: string[];
}

interface CategoryFormState {
  name: string;
  description: string;
  specialtyId: string;
}

interface SpecialtyFormState {
  name: string;
  description: string;
}

interface HierarchyFormProps {
  activeTab: string;
  editingItem: any;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  specialties: Specialty[];
  categories: Category[];
  procedureForm: ProcedureFormState;
  setProcedureForm: (value: ProcedureFormState) => void;
  categoryForm: CategoryFormState;
  setCategoryForm: (value: CategoryFormState) => void;
  specialtyForm: SpecialtyFormState;
  setSpecialtyForm: (value: SpecialtyFormState) => void;
  specialtyId?: string;
  onCategoriesUpdate?: () => void;
  onClose: () => void;
  procedureTypes?: ProcedureType[];
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
  procedureTypes,
}: HierarchyFormProps) {
  const [showQuickAddCat, setShowQuickAddCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');

  const handleQuickAddCategory = async () => {
    if (!quickCatName.trim()) return;
    try {
      const response = await apiClient.post('/api/admin/procedures/categories', {
        name: quickCatName,
        specialtyId: specialtyId || procedureForm.specialtyId,
      });
      const data = response.data;
      if (data.success) {
        toast.success('Category created');
        setQuickCatName('');
        setShowQuickAddCat(false);
        if (onCategoriesUpdate) onCategoriesUpdate();
        setProcedureForm({ ...procedureForm, categoryId: data.data.id });
      } else {
        toast.error(data.message || 'Failed to create category');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-5">
        <div className="mb-2 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
          {editingItem ? 'Update existing item' : 'Create new item'}
        </div>
        <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
          {editingItem ? 'Edit' : 'Add New'} {activeTab === 'specialty' ? 'Specialty Info' : activeTab.slice(0, -1)}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">Fill in the details below to save your changes.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 pt-2">
        {activeTab === 'specialty' && (
          <>
            <div className="space-y-2">
              <Label>Specialty *</Label>
              <Input
                value={specialtyForm.name}
                onChange={(e) => setSpecialtyForm({ ...specialtyForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={specialtyForm.description}
                onChange={(e) => setSpecialtyForm({ ...specialtyForm, description: e.target.value })}
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
                    {specialties.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                  <Input
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
                      .filter((c) => c.specialtyId === (specialtyId || procedureForm.specialtyId))
                      .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
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
                {procedureTypes?.map((pt) => (
                  <label key={pt.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={procedureForm.typeIds.includes(pt.id)}
                      onChange={(e) => {
                        const newTypeIds = e.target.checked
                          ? [...procedureForm.typeIds, pt.id]
                          : procedureForm.typeIds.filter((id) => id !== pt.id);
                        setProcedureForm({ ...procedureForm, typeIds: newTypeIds });
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
                    {specialties.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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

        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="shadow-sm border-slate-200 bg-slate-50/50 text-slate-600">
            Cancel
          </Button>
          <Button type="submit" className="min-w-[120px] bg-teal-700 shadow-sm hover:bg-teal-800" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingItem ? 'Update' : 'Create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
