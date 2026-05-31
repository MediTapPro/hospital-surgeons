'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/button';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  tier: string;
  userRole: 'doctor' | 'hospital';
  isActive?: boolean;
  description?: string;
  defaultBillingCycle?: string;
  price?: number;
  currency?: string;
  priceFormatted?: string;
  pricingOptions?: PricingOption[];
  subscribers: number;
  features?: any;
}

interface PricingOption {
  id: string;
  billingCycle: string;
  billingPeriodMonths: number;
  price: number;
  currency: string;
  discountPercentage: number;
  isActive: boolean;
}

function PlanCard({ plan, onEdit, onDelete, deleting }: { plan: Plan; onEdit: (plan: Plan) => void; onDelete: (plan: Plan) => void; deleting: boolean }) {
  const getTierColor = (tier: string) => {
    if (tier === 'free' || tier === 'basic') return 'bg-blue-100 text-blue-700';
    if (tier === 'premium') return 'bg-purple-100 text-purple-700';
    if (tier === 'enterprise') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  };

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      free: 'Free',
      basic: 'Tier 1',
      premium: 'Tier 2',
      enterprise: 'Tier 3',
    };
    return labels[tier] || tier;
  };

  // Format features for display
  const formatFeatures = () => {
    if (!plan.features) return [];
    
    const features: string[] = [];
    if (plan.userRole === 'doctor') {
      if (plan.features.visibilityWeight) {
        features.push(`Visibility Weight: ${plan.features.visibilityWeight}`);
      }
      if (plan.features.maxAffiliations) {
        features.push(`Max Affiliations: ${plan.features.maxAffiliations}`);
      }
      if (plan.features.maxAssignmentsPerMonth !== null && plan.features.maxAssignmentsPerMonth !== undefined) {
        if (plan.features.maxAssignmentsPerMonth === -1) {
          features.push('Max Assignments: Unlimited');
        } else {
          features.push(`Max Assignments/Month: ${plan.features.maxAssignmentsPerMonth}`);
        }
      }
    } else {
      if (plan.features.maxPatientsPerMonth !== null && plan.features.maxPatientsPerMonth !== undefined) {
        if (plan.features.maxPatientsPerMonth === -1) {
          features.push('Max Patients: Unlimited');
        } else {
          features.push(`Max Patients/Month: ${plan.features.maxPatientsPerMonth}`);
        }
      }
      if (plan.features.maxAssignmentsPerMonth !== null && plan.features.maxAssignmentsPerMonth !== undefined) {
        if (plan.features.maxAssignmentsPerMonth === -1) {
          features.push('Max Assignments: Unlimited');
        } else {
          features.push(`Max Assignments/Month: ${plan.features.maxAssignmentsPerMonth}`);
        }
      }
      if (plan.features.includesPremiumDoctors) {
        features.push('Includes Premium Doctors');
      }
    }
    // Skip notes that contain "Features for plan" (these are system-generated, not user-facing features)
    if (plan.features.notes && !plan.features.notes.toLowerCase().includes('features for plan')) {
      features.push(plan.features.notes);
    }
    return features;
  };

  const displayFeatures = formatFeatures();

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-slate-200 relative z-0">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-slate-900 font-semibold">{plan.name}</h3>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 mt-2 text-xs font-medium ${getTierColor(plan.tier)}`}>
            {getTierLabel(plan.tier)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(plan)} disabled={deleting} title="Edit Plan & Features">
            <Edit className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(plan)} disabled={deleting} title="Delete Plan">
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
            ) : (
              <Trash2 className="w-4 h-4 text-red-600" />
            )}
          </Button>
        </div>
      </div>
      {/* Pricing Options - Hidden for free plans */}
      {plan.tier !== 'free' && plan.pricingOptions && plan.pricingOptions.length > 0 ? (
        <div className="mb-4">
          <p className="text-sm text-slate-600 mb-2">Pricing Options:</p>
          {plan.pricingOptions.map((pricing) => (
            <div key={pricing.id} className="text-sm mb-1">
              <span className="font-medium">{pricing.billingCycle}:</span>
              <span className="ml-2">{pricing.currency} {Number(pricing.price).toFixed(2)}</span>
              {pricing.discountPercentage > 0 && (
                <span className="text-green-600 ml-2">({pricing.discountPercentage}% off)</span>
              )}
            </div>
          ))}
        </div>
      ) : plan.tier !== 'free' ? (
        <p className="text-lg text-slate-500 mb-4 italic">No pricing options</p>
      ) : null}
      {/* Features List */}
      {displayFeatures.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {displayFeatures.map((feature, idx) => (
            <li key={idx} className="text-slate-600 flex items-start gap-2">
              <span className="text-teal-600 mt-1">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500 mb-4 italic">No features configured</p>
      )}
      <div className="pt-4 border-t border-slate-200">
        <p className="text-slate-600">
          <span className="text-slate-900 font-semibold">{plan.subscribers}</span> active subscribers
        </p>
      </div>
    </div>
  );
}

export function SubscriptionPlans() {
  const [doctorPlans, setDoctorPlans] = useState<Plan[]>([]);
  const [hospitalPlans, setHospitalPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [activeTab, setActiveTab] = useState<'doctors' | 'hospitals'>('doctors');
  const [modalTab, setModalTab] = useState<'details' | 'features'>('details');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tier: 'basic',
    userRole: 'doctor' as 'doctor' | 'hospital',
    description: '',
    isActive: true,
    defaultBillingCycle: 'monthly' as 'monthly' | 'quarterly' | 'yearly' | 'custom',
  });
  const [pricingData, setPricingData] = useState<PricingOption[]>([]);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [editingPricing, setEditingPricing] = useState<PricingOption | null>(null);
  const [pricingForm, setPricingForm] = useState<{
    billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'custom';
    billingPeriodMonths: number | string;
    price: string;
    currency: string;
    setupFee: string;
    discountPercentage: string;
    isActive: boolean;
  }>({
    billingCycle: 'monthly',
    billingPeriodMonths: 1,
    price: '',
    currency: 'INR',
    setupFee: '',
    discountPercentage: '',
    isActive: true,
  });
  const [featuresData, setFeaturesData] = useState({
    // Doctor features
    visibilityWeight: 1,
    maxAffiliations: 1,
    maxAssignmentsPerMonth: '',
    // Hospital features
    maxPatientsPerMonth: '',
    hospitalMaxAssignmentsPerMonth: '',
    includesPremiumDoctors: false,
    // Common
    notes: '',
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/plans');
      const data = await res.json();

      if (data.success) {
        // Pricing options are already included in the response from API
        setDoctorPlans(data.grouped?.doctors || []);
        setHospitalPlans(data.grouped?.hospitals || []);
        
        // Fetch features for each plan
        const allPlans = [...(data.grouped?.doctors || []), ...(data.grouped?.hospitals || [])];
        for (const plan of allPlans) {
          await fetchPlanFeatures(plan);
        }
      } else {
        toast.error(data.message || 'Failed to fetch subscription plans');
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to fetch subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const loadPlanFeatures = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}/features`);
      const data = await res.json();
      
      if (data.success && data.data) {
        const features = data.data;
        if (plan.userRole === 'doctor') {
          setFeaturesData({
            visibilityWeight: features.visibilityWeight || 1,
            maxAffiliations: features.maxAffiliations || 1,
            maxAssignmentsPerMonth: features.maxAssignmentsPerMonth !== null && features.maxAssignmentsPerMonth !== undefined 
              ? (features.maxAssignmentsPerMonth === -1 ? 'unlimited' : String(features.maxAssignmentsPerMonth))
              : '',
            maxPatientsPerMonth: '',
            hospitalMaxAssignmentsPerMonth: '',
            includesPremiumDoctors: false,
            notes: features.notes || '',
          });
        } else {
          setFeaturesData({
            visibilityWeight: 1,
            maxAffiliations: 1,
            maxAssignmentsPerMonth: '',
            maxPatientsPerMonth: features.maxPatientsPerMonth !== null && features.maxPatientsPerMonth !== undefined
              ? (features.maxPatientsPerMonth === -1 ? 'unlimited' : String(features.maxPatientsPerMonth))
              : '',
            hospitalMaxAssignmentsPerMonth: features.maxAssignmentsPerMonth !== null && features.maxAssignmentsPerMonth !== undefined
              ? (features.maxAssignmentsPerMonth === -1 ? 'unlimited' : String(features.maxAssignmentsPerMonth))
              : '',
            includesPremiumDoctors: features.includesPremiumDoctors || false,
            notes: features.notes || '',
          });
        }
      } else {
        // No features yet, set defaults
        if (plan.userRole === 'doctor') {
          setFeaturesData({
            visibilityWeight: 1,
            maxAffiliations: 1,
            maxAssignmentsPerMonth: '',
            maxPatientsPerMonth: '',
            hospitalMaxAssignmentsPerMonth: '',
            includesPremiumDoctors: false,
            notes: '',
          });
        } else {
          setFeaturesData({
            visibilityWeight: 1,
            maxAffiliations: 1,
            maxAssignmentsPerMonth: '',
            maxPatientsPerMonth: '',
            hospitalMaxAssignmentsPerMonth: '',
            includesPremiumDoctors: false,
            notes: '',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching plan features:', error);
      // Set defaults on error
      if (plan.userRole === 'doctor') {
        setFeaturesData({
          visibilityWeight: 1,
          maxAffiliations: 1,
          maxAssignmentsPerMonth: '',
          maxPatientsPerMonth: '',
          hospitalMaxAssignmentsPerMonth: '',
          includesPremiumDoctors: false,
          notes: '',
        });
      } else {
        setFeaturesData({
          visibilityWeight: 1,
          maxAffiliations: 1,
          maxAssignmentsPerMonth: '',
          maxPatientsPerMonth: '',
          hospitalMaxAssignmentsPerMonth: '',
          includesPremiumDoctors: false,
          notes: '',
        });
      }
    }
  };


  const formatFeaturesForAPI = (userRole: 'doctor' | 'hospital') => {
    if (userRole === 'doctor') {
      return {
        visibilityWeight: featuresData.visibilityWeight,
        maxAffiliations: featuresData.maxAffiliations,
        maxAssignmentsPerMonth: featuresData.maxAssignmentsPerMonth === 'unlimited' || featuresData.maxAssignmentsPerMonth === ''
          ? (featuresData.maxAssignmentsPerMonth === 'unlimited' ? -1 : null)
          : (featuresData.maxAssignmentsPerMonth ? parseInt(featuresData.maxAssignmentsPerMonth) : null),
        notes: featuresData.notes || null,
      };
    } else {
      return {
        maxPatientsPerMonth: featuresData.maxPatientsPerMonth === 'unlimited' || featuresData.maxPatientsPerMonth === ''
          ? (featuresData.maxPatientsPerMonth === 'unlimited' ? -1 : null)
          : (featuresData.maxPatientsPerMonth ? parseInt(featuresData.maxPatientsPerMonth) : null),
        maxAssignmentsPerMonth: featuresData.hospitalMaxAssignmentsPerMonth === 'unlimited' || featuresData.hospitalMaxAssignmentsPerMonth === ''
          ? (featuresData.hospitalMaxAssignmentsPerMonth === 'unlimited' ? -1 : null)
          : (featuresData.hospitalMaxAssignmentsPerMonth ? parseInt(featuresData.hospitalMaxAssignmentsPerMonth) : null),
        includesPremiumDoctors: featuresData.includesPremiumDoctors,
        notes: featuresData.notes || null,
      };
    }
  };


  const fetchPlanFeatures = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}/features`);
      const data = await res.json();
      if (data.success && data.data) {
        plan.features = data.data;
        if (plan.userRole === 'doctor') {
          setDoctorPlans(prev => prev.map(p => p.id === plan.id ? { ...p, features: data.data } : p));
        } else {
          setHospitalPlans(prev => prev.map(p => p.id === plan.id ? { ...p, features: data.data } : p));
        }
      }
    } catch (error) {
      console.error('Error fetching plan features:', error);
    }
  };

  const validateForm = () => {
    // Plan Details validation (no price/currency needed - Approach 3)
    if (!formData.name.trim()) return false;
    if (!formData.userRole) return false;
    if (!formData.tier) return false;

    // Features validation based on user role
    if (formData.userRole === 'doctor') {
      if (!featuresData.visibilityWeight || featuresData.visibilityWeight < 1) return false;
      if (!featuresData.maxAffiliations || featuresData.maxAffiliations < 1) return false;
      if (!featuresData.maxAssignmentsPerMonth.trim()) return false;
    } else {
      // Hospital: all features required except notes
      if (!featuresData.maxPatientsPerMonth.trim()) return false;
      if (!featuresData.hospitalMaxAssignmentsPerMonth.trim()) return false;
      // includesPremiumDoctors is a checkbox, always has a value (true/false)
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields
    if (!validateForm()) {
      toast.error('Please fill all required fields in both tabs');
      return;
    }

    try {
      setSubmitting(true);
      
      // Single API for both create and update
      const url = editingPlan
        ? `/api/admin/plans/${editingPlan.id}`
        : '/api/admin/plans';
      
      const method = editingPlan ? 'PUT' : 'POST';
      
      // Format features for API
      const features = formatFeaturesForAPI(formData.userRole);
      
      // Send plan and features together in one request (no price/currency - Approach 3)
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          tier: formData.tier,
          userRole: formData.userRole,
          description: formData.description || null,
          isActive: formData.isActive,
          // Only include defaultBillingCycle for non-free plans
          ...(formData.tier !== 'free' && { defaultBillingCycle: formData.defaultBillingCycle }),
          features: features, // Always include features
        }),
      });

      const data = await res.json();

      if (data.success) {
        const successMessage = editingPlan 
          ? 'Plan and features updated successfully' 
          : 'Plan created successfully! You can now add pricing options.';
        toast.success(successMessage);
        
        if (editingPlan) {
          // If editing, refresh pricing and close modal
          await fetchPricingOptions(editingPlan.id);
          setShowAddModal(false);
          setEditingPlan(null);
          setModalTab('details');
          setFormData({ name: '', tier: 'basic', userRole: 'doctor', description: '', isActive: true, defaultBillingCycle: 'monthly' });
          setPricingData([]);
        } else {
          // If creating new plan, keep modal open and switch to edit mode to add pricing
          const newPlanId = data.data?.id;
          if (newPlanId) {
            // Fetch the created plan and set it as editing plan
            const planRes = await fetch(`/api/admin/plans/${newPlanId}`);
            const planData = await planRes.json();
            if (planData.success) {
              setEditingPlan(planData.data);
              await fetchPricingOptions(newPlanId);
              toast.info('Plan created! Add pricing options below.');
            }
          }
        }
        
        setFeaturesData({
          visibilityWeight: 1,
          maxAffiliations: 1,
          maxAssignmentsPerMonth: '',
          maxPatientsPerMonth: '',
          hospitalMaxAssignmentsPerMonth: '',
          includesPremiumDoctors: false,
          notes: '',
        });
        fetchPlans();
      } else {
        toast.error(data.message || 'Failed to save plan');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      tier: plan.tier,
      userRole: plan.userRole,
      description: plan.description || '',
      isActive: plan.isActive !== undefined ? plan.isActive : true,
      // Only set defaultBillingCycle for non-free plans
      defaultBillingCycle: plan.tier === 'free' ? undefined : ((plan.defaultBillingCycle as any) || 'monthly'),
    });
    // Load pricing options
    if (plan.id) {
      await fetchPricingOptions(plan.id);
    }
    await loadPlanFeatures(plan);
    setActiveTab(plan.userRole === 'doctor' ? 'doctors' : 'hospitals');
    setModalTab('details');
    setShowAddModal(true);
  };

  const fetchPricingOptions = async (planId: string) => {
    try {
      const res = await fetch(`/api/admin/plans/${planId}/pricing`);
      const data = await res.json();
      if (data.success) {
        setPricingData(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching pricing options:', error);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Are you sure you want to delete "${plan.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(plan.id);
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Plan deleted successfully');
        fetchPlans();
      } else {
        toast.error(data.message || 'Failed to delete plan');
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingPlan(null);
    setModalTab('details');
    setFormData({ name: '', tier: 'basic', userRole: 'doctor', description: '', isActive: true, defaultBillingCycle: 'monthly' });
    setPricingData([]);
    setShowPricingModal(false);
    setEditingPricing(null);
    setFeaturesData({
      visibilityWeight: 1,
      maxAffiliations: 1,
      maxAssignmentsPerMonth: '',
      maxPatientsPerMonth: '',
      hospitalMaxAssignmentsPerMonth: '',
      includesPremiumDoctors: false,
      notes: '',
    });
  };

  const handleAddNew = () => {
    setEditingPlan(null);
    setModalTab('details');
    setFormData({ 
      name: '', 
      tier: 'basic', 
      userRole: activeTab === 'doctors' ? 'doctor' : 'hospital',
      description: '',
      isActive: true,
      defaultBillingCycle: 'monthly',
    });
    setPricingData([]);
    setFeaturesData({
      visibilityWeight: 1,
      maxAffiliations: 1,
      maxAssignmentsPerMonth: '',
      maxPatientsPerMonth: '',
      hospitalMaxAssignmentsPerMonth: '',
      includesPremiumDoctors: false,
      notes: '',
    });
    setShowAddModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Subscription Plans" 
        description="Manage pricing tiers and features for doctors and hospitals"
        actions={
          <Button onClick={handleAddNew} className="bg-navy-600 hover:bg-navy-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Plan
          </Button>
        }
      />

      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'doctors' | 'hospitals')} className="space-y-6">
            <TabsList>
              <TabsTrigger value="doctors">Doctor Plans</TabsTrigger>
              <TabsTrigger value="hospitals">Hospital Plans</TabsTrigger>
            </TabsList>

            <TabsContent value="doctors" className="space-y-4">
              {doctorPlans.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No doctor plans found. Create one to get started.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {doctorPlans.map((plan) => (
                    <PlanCard 
                      key={plan.id} 
                      plan={plan} 
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      deleting={deletingId === plan.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="hospitals" className="space-y-4">
              {hospitalPlans.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No hospital plans found. Create one to get started.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hospitalPlans.map((plan) => (
                    <PlanCard 
                      key={plan.id} 
                      plan={plan} 
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      deleting={deletingId === plan.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Combined Add/Edit Modal with Tabs */}
      <Dialog open={showAddModal} onOpenChange={handleCloseModal}>
        <DialogContent aria-describedby={undefined} className="max-w-3xl bg-white dark:bg-gray-900 max-h-[90vh] overflow-y-auto" style={{ zIndex: 100 }}>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'details' | 'features')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="details">Plan Details</TabsTrigger>
                <TabsTrigger value="features">Features & Limits</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4">
                <div>
                  <Label htmlFor="name">Plan Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Basic, Professional, Premium"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userRole">User Role *</Label>
                    <Select
                      value={formData.userRole}
                      onValueChange={(value) => {
                        setFormData({ ...formData, userRole: value as 'doctor' | 'hospital' });
                        // Reset features when role changes
                        if (value === 'doctor') {
                          setFeaturesData({
                            visibilityWeight: 1,
                            maxAffiliations: 1,
                            maxAssignmentsPerMonth: '',
                            maxPatientsPerMonth: '',
                            hospitalMaxAssignmentsPerMonth: '',
                            includesPremiumDoctors: false,
                            notes: '',
                          });
                        } else {
                          setFeaturesData({
                            visibilityWeight: 1,
                            maxAffiliations: 1,
                            maxAssignmentsPerMonth: '',
                            maxPatientsPerMonth: '',
                            hospitalMaxAssignmentsPerMonth: '',
                            includesPremiumDoctors: false,
                            notes: '',
                          });
                        }
                      }}
                      disabled={!!editingPlan}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="tier">Tier *</Label>
                    <Select
                      value={formData.tier}
                      onValueChange={(value) => {
                        // Clear defaultBillingCycle when switching to free tier
                        const updates: any = { tier: value };
                        if (value === 'free') {
                          updates.defaultBillingCycle = undefined;
                        } else if (formData.tier === 'free' && !formData.defaultBillingCycle) {
                          // Set default to monthly when switching from free to paid
                          updates.defaultBillingCycle = 'monthly';
                        }
                        setFormData({ ...formData, ...updates });
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description for this plan..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className={`grid gap-4 ${formData.tier === 'free' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {formData.tier !== 'free' ? (
                    <div key="billing-cycle-field">
                      <Label htmlFor="defaultBillingCycle">Default Billing Cycle</Label>
                      <Select
                        value={formData.defaultBillingCycle || 'monthly'}
                        onValueChange={(value) => setFormData({ ...formData, defaultBillingCycle: value as any })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select billing cycle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className={`flex items-center space-x-2 ${formData.tier === 'free' ? '' : 'pt-8'}`}>
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">Plan is Active</Label>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Pricing Options {editingPlan ? `(${pricingData.length})` : ''}</Label>
                    {editingPlan ? (
                      editingPlan.tier === 'free' ? (
                        <p className="text-sm text-gray-500 italic">Free plans do not require pricing options</p>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingPricing(null);
                            setPricingForm({
                              billingCycle: 'monthly',
                              billingPeriodMonths: 1,
                              price: '',
                              currency: 'INR',
                              setupFee: '',
                              discountPercentage: '',
                              isActive: true,
                            });
                            setShowPricingModal(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Pricing
                        </Button>
                      )
                    ) : (
                      <p className="text-sm text-gray-500">Create plan first, then add pricing options</p>
                    )}
                  </div>
                  {editingPlan ? (
                    <>
                      {editingPlan.tier === 'free' ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Free Plan:</strong> This plan does not require pricing options. Users can subscribe to free plans without payment.
                          </p>
                        </div>
                      ) : pricingData.length === 0 ? (
                        <p className="text-sm text-gray-500">No pricing options added yet</p>
                      ) : (
                        <div className="space-y-2">
                          {pricingData.map((pricing) => (
                            <div key={pricing.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="font-medium">{pricing.billingCycle}</span>
                                <span className="text-sm text-gray-600 ml-2">
                                  {pricing.currency} {Number(pricing.price).toFixed(2)} / {pricing.billingPeriodMonths} month(s)
                                  {pricing.discountPercentage > 0 && (
                                    <span className="text-green-600 ml-2">({pricing.discountPercentage}% off)</span>
                                  )}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingPricing(pricing);
                                    setPricingForm({
                                      billingCycle: pricing.billingCycle as any,
                                      billingPeriodMonths: pricing.billingPeriodMonths,
                                      price: Number(pricing.price).toFixed(2),
                                      currency: 'INR', // Always use INR
                                      setupFee: '0',
                                      discountPercentage: pricing.discountPercentage.toString(),
                                      isActive: pricing.isActive,
                                    });
                                    setShowPricingModal(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (confirm('Delete this pricing option?')) {
                                      try {
                                        const res = await fetch(`/api/admin/plans/${editingPlan.id}/pricing/${pricing.id}`, {
                                          method: 'DELETE',
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                          toast.success('Pricing option deleted');
                                          await fetchPricingOptions(editingPlan.id);
                                        } else {
                                          toast.error(data.message || 'Failed to delete pricing');
                                        }
                                      } catch (error) {
                                        console.error('Error deleting pricing:', error);
                                        toast.error('Failed to delete pricing');
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Save the plan to add pricing options</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="features" className="space-y-4">
                {formData.userRole === 'doctor' ? (
                  <>
                    <div>
                      <Label htmlFor="visibilityWeight">Visibility Weight *</Label>
                      <Input
                        id="visibilityWeight"
                        type="number"
                        min="1"
                        value={featuresData.visibilityWeight}
                        onChange={(e) => setFeaturesData({ ...featuresData, visibilityWeight: parseInt(e.target.value) || 1 })}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Higher weight = better visibility in search results</p>
                    </div>
                    <div>
                      <Label htmlFor="maxAffiliations">Max Affiliations *</Label>
                      <Input
                        id="maxAffiliations"
                        type="number"
                        min="1"
                        value={featuresData.maxAffiliations}
                        onChange={(e) => setFeaturesData({ ...featuresData, maxAffiliations: parseInt(e.target.value) || 1 })}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxAssignmentsPerMonth">Max Assignments Per Month *</Label>
                      <Input
                        id="maxAssignmentsPerMonth"
                        type="text"
                        placeholder="Enter number or 'unlimited'"
                        value={featuresData.maxAssignmentsPerMonth}
                        onChange={(e) => setFeaturesData({ ...featuresData, maxAssignmentsPerMonth: e.target.value })}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter a number or 'unlimited' for -1</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="maxPatientsPerMonth">Max Patients Per Month *</Label>
                      <Input
                        id="maxPatientsPerMonth"
                        type="text"
                        placeholder="Enter number or 'unlimited'"
                        value={featuresData.maxPatientsPerMonth}
                        onChange={(e) => setFeaturesData({ ...featuresData, maxPatientsPerMonth: e.target.value })}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter a number or 'unlimited' for -1</p>
                    </div>
                    <div>
                      <Label htmlFor="hospitalMaxAssignmentsPerMonth">Max Assignments Per Month *</Label>
                      <Input
                        id="hospitalMaxAssignmentsPerMonth"
                        type="text"
                        placeholder="Enter number or 'unlimited'"
                        value={featuresData.hospitalMaxAssignmentsPerMonth}
                        onChange={(e) => setFeaturesData({ ...featuresData, hospitalMaxAssignmentsPerMonth: e.target.value })}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter a number or 'unlimited' for -1</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includesPremiumDoctors"
                        checked={featuresData.includesPremiumDoctors}
                        onChange={(e) => setFeaturesData({ ...featuresData, includesPremiumDoctors: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="includesPremiumDoctors" className="cursor-pointer">
                        Includes Premium Doctors Access
                      </Label>
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes about this plan..."
                    value={featuresData.notes}
                    onChange={(e) => setFeaturesData({ ...featuresData, notes: e.target.value })}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button 
                type="button"
                variant="outline" 
                onClick={handleCloseModal}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-navy-600 hover:bg-navy-700"
                disabled={submitting || !validateForm()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingPlan ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingPlan ? 'Update Plan & Features' : 'Create Plan & Features'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pricing Management Modal */}
      <Dialog open={showPricingModal} onOpenChange={setShowPricingModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPricing ? 'Edit Pricing Option' : 'Add Pricing Option'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!editingPlan) return;
            
            try {
              const url = editingPricing
                ? `/api/admin/plans/${editingPlan.id}/pricing/${editingPricing.id}`
                : `/api/admin/plans/${editingPlan.id}/pricing`;
              
              const method = editingPricing ? 'PUT' : 'POST';
              
              const billingPeriodMonths = pricingForm.billingCycle === 'monthly' ? 1
                : pricingForm.billingCycle === 'quarterly' ? 3
                : pricingForm.billingCycle === 'yearly' ? 12
                : (typeof pricingForm.billingPeriodMonths === 'number' 
                    ? pricingForm.billingPeriodMonths 
                    : parseInt(pricingForm.billingPeriodMonths.toString()) || 1);

              const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  billingCycle: pricingForm.billingCycle,
                  billingPeriodMonths: billingPeriodMonths,
                  price: parseFloat(pricingForm.price), // Send in rupees, backend will convert to paise
                  currency: 'INR', // Always use INR (Indian Rupees)
                  setupFee: parseFloat(pricingForm.setupFee || '0'), // Send in rupees, backend will convert to paise
                  discountPercentage: parseFloat(pricingForm.discountPercentage || '0'),
                  isActive: pricingForm.isActive,
                }),
              });

              const data = await res.json();
              if (data.success) {
                toast.success(editingPricing ? 'Pricing updated successfully' : 'Pricing added successfully');
                setShowPricingModal(false);
                setEditingPricing(null);
                await fetchPricingOptions(editingPlan.id);
              } else {
                toast.error(data.message || 'Failed to save pricing');
              }
            } catch (error) {
              console.error('Error saving pricing:', error);
              toast.error('Failed to save pricing');
            }
          }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pricingBillingCycle">Billing Cycle *</Label>
                  <Select
                    value={pricingForm.billingCycle}
                    onValueChange={(value) => {
                      const months = value === 'monthly' ? 1 : value === 'quarterly' ? 3 : value === 'yearly' ? 12 : pricingForm.billingPeriodMonths;
                      setPricingForm({ ...pricingForm, billingCycle: value as any, billingPeriodMonths: months });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {pricingForm.billingCycle === 'custom' && (
                  <div>
                    <Label htmlFor="billingPeriodMonths">Period (Months) *</Label>
                    <Input
                      id="billingPeriodMonths"
                      type="number"
                      min="1"
                      value={pricingForm.billingPeriodMonths || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPricingForm({ 
                          ...pricingForm, 
                          billingPeriodMonths: value === '' ? '' : parseInt(value) || ''
                        });
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || parseInt(value) < 1) {
                          setPricingForm({ ...pricingForm, billingPeriodMonths: 1 });
                        }
                      }}
                      className="mt-1"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pricingPrice">Price *</Label>
                  <Input
                    id="pricingPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={pricingForm.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string, numbers, and decimal numbers
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setPricingForm({ ...pricingForm, price: value });
                      }
                    }}
                    className="mt-1"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter price in actual currency (e.g., 499.00 for ₹499.00)</p>
                </div>
                <div>
                  <Label htmlFor="pricingCurrency">Currency *</Label>
                  <Input
                    id="pricingCurrency"
                    type="text"
                    value="INR (₹)"
                    disabled
                    className="mt-1 bg-gray-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Currency is fixed to INR (Indian Rupees)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="setupFee">Setup Fee</Label>
                  <Input
                    id="setupFee"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={pricingForm.setupFee}
                    onChange={(e) => setPricingForm({ ...pricingForm, setupFee: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="discountPercentage">Discount %</Label>
                  <Input
                    id="discountPercentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    value={pricingForm.discountPercentage}
                    onChange={(e) => setPricingForm({ ...pricingForm, discountPercentage: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="pricingIsActive"
                  checked={pricingForm.isActive}
                  onChange={(e) => setPricingForm({ ...pricingForm, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="pricingIsActive" className="cursor-pointer">Active</Label>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPricingModal(false);
                  setEditingPricing(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-navy-600 hover:bg-navy-700"
              >
                {editingPricing ? 'Update Pricing' : 'Add Pricing'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
