'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Crown, Star, Loader2, AlertCircle, History, Package } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth/utils';
import apiClient from '@/lib/api/httpClient';
import { toast } from 'sonner';

interface PricingOption {
  id: string;
  billingCycle: string;
  billingPeriodMonths: number;
  price: number; // in cents
  currency: string;
  setupFee: number;
  discountPercentage: number;
  isActive: boolean;
}

interface Plan {
  id: string;
  name: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  userRole: string;
  pricingOptions?: PricingOption[];
  hospitalFeatures?: {
    maxPatientsPerMonth: number | null;
    includesPremiumDoctors: boolean | null;
    maxAssignmentsPerMonth: number | null;
    notes: string | null;
  } | null;
}

interface Subscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  billingCycle?: string;
  billingPeriodMonths?: number;
  priceAtPurchase?: number;
  currencyAtPurchase?: string;
  pricingId?: string;
  plan: Plan;
  nextPlanId?: string | null;
  nextPricingId?: string | null;
  planChangeStatus?: string | null;
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<Record<string, string>>({}); // planId -> pricingId
  const [showPlans, setShowPlans] = useState(false); // Hide plans by default
  const [subscriptionHistory, setSubscriptionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchData();
      fetchSubscriptionHistory();
    } else {
      router.push('/login');
    }
  }, []);

  const fetchSubscriptionHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await apiClient.get('/api/subscriptions/history?limit=50');
      if (response.data.success) {
        setSubscriptionHistory(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Error fetching subscription history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch available plans for hospitals
      const plansResponse = await apiClient.get('/api/subscriptions/plans');
      if (plansResponse.data.success && plansResponse.data.data) {
        const hospitalPlans = plansResponse.data.data.filter(
          (plan: Plan) => plan.userRole === 'hospital'
        );
        setPlans(hospitalPlans);
      } else {
        console.error('Failed to fetch plans:', plansResponse.data);
        const errorMessage = plansResponse.data?.message || plansResponse.data?.error || 'Failed to load subscription plans';
        toast.error(errorMessage);
      }

      // Fetch current subscription
      const subscriptionResponse = await apiClient.get('/api/subscriptions/current');
      if (subscriptionResponse.data.success && subscriptionResponse.data.data) {
        const subscriptionData = subscriptionResponse.data.data;
        if (subscriptionData && subscriptionData.subscription && subscriptionData.plan) {
          const sub = subscriptionData.subscription;
          const currentSub = {
            id: sub.id,
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
            billingCycle: sub.billingCycle || sub.billing_cycle,
            billingPeriodMonths: sub.billingPeriodMonths || sub.billing_period_months,
            priceAtPurchase: sub.priceAtPurchase || sub.price_at_purchase,
            currencyAtPurchase: sub.currencyAtPurchase || sub.currency_at_purchase,
            pricingId: sub.pricingId || sub.pricing_id,
            plan: subscriptionData.plan,
            nextPlanId: sub.nextPlanId || sub.next_plan_id,
            nextPricingId: sub.nextPricingId || sub.next_pricing_id,
            planChangeStatus: sub.planChangeStatus || sub.plan_change_status,
          };
          setCurrentSubscription(currentSub);
          
          // Set default selected pricing for current plan
          if (currentSub.plan.pricingOptions && currentSub.plan.pricingOptions.length > 0) {
            const currentPricing = currentSub.plan.pricingOptions.find(
              (p: PricingOption) => p.billingCycle === currentSub.billingCycle
            ) || currentSub.plan.pricingOptions[0];
            if (currentPricing) {
              setSelectedPricing(prev => ({
                ...prev,
                [currentSub.plan.id]: currentPricing.id
              }));
            }
          }

        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to load subscription data';
      if (error.response?.status !== 404) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if a plan is an upgrade over current plan
  const isUpgrade = (currentTier: string, newTier: string): boolean => {
    const tierOrder: Record<string, number> = {
      'free': 0,
      'basic': 1,
      'premium': 2,
      'enterprise': 3,
    };
    return (tierOrder[newTier] || 0) > (tierOrder[currentTier] || 0);
  };

  const handleUpgrade = async (planId: string, pricingId?: string) => {
    try {
      if (!currentSubscription) {
        toast.error('No active subscription found');
        return;
      }

      setUpgrading(planId);

      // Get plan details
      const planResponse = await apiClient.get(`/api/subscriptions/plans/${planId}`);
      if (!planResponse.data.success || !planResponse.data.data) {
        throw new Error('Plan not found');
      }

      const plan = planResponse.data.data;

      // If free plan, activate directly
      if (plan.tier === 'free') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 10); // Free plan valid for 10 years

        const subscriptionData = {
          planId: planId,
          status: 'active',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          autoRenew: false,
        };

        const createResponse = await apiClient.post('/api/subscriptions', subscriptionData);
        if (createResponse.data.success) {
          toast.success('Free plan activated successfully!');
          await fetchData();
          router.push('/hospital/dashboard');
        } else {
          throw new Error(createResponse.data.message || 'Failed to activate plan');
        }
        return;
      }

      // Paid plan - need to select pricing option first
      if (!pricingId) {
        toast.error('Please select a billing cycle');
        setUpgrading(null);
        return;
      }

      // For ALL paid plans: Create order → Pay → Verify (handles upgrade/change automatically)
      // No separate API calls needed - everything goes through payment flow
      try {
        const checkoutResponse = await apiClient.post('/api/payments/create-order', {
          planId: planId,
          pricingId: pricingId,
          gateway: 'razorpay',
        });

        if (checkoutResponse.data.success && checkoutResponse.data.data?.session?.checkoutData) {
          const orderStatus = checkoutResponse.data.data?.status || 'pending';
          const checkoutData = checkoutResponse.data.data.session.checkoutData;
          
          if (orderStatus === 'pending') {
            toast.info('Order created. Redirecting to payment...');
          } else if (orderStatus === 'paid') {
            toast.success('Payment already processed!');
          } else if (orderStatus === 'failed') {
            toast.error('Previous payment failed. Please try again.');
          }
          
          const urlParams = new URLSearchParams({
            order_id: checkoutData.orderId,
          });
          if (checkoutData.planId) urlParams.set('planId', checkoutData.planId);
          if (checkoutData.userRole) urlParams.set('userRole', checkoutData.userRole);
          if (checkoutData.email) urlParams.set('email', checkoutData.email);
          const checkoutUrl = `/checkout/razorpay?${urlParams.toString()}`;
          
          window.location.href = checkoutUrl;
        } else {
          throw new Error('Failed to create checkout session');
        }
      } catch (checkoutError: any) {
        console.error('Checkout error:', checkoutError);
        toast.error(checkoutError.response?.data?.message || checkoutError.message || 'Failed to initiate checkout');
        setUpgrading(null);
      }
    } catch (error: any) {
      console.error('Error handling plan change:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to process plan change');
      setUpgrading(null);
    }
  };


  const getPlanFeatures = (plan: Plan): string[] => {
    const features: string[] = [];
    
    // If plan has hospitalFeatures from database, use those
    if (plan.hospitalFeatures) {
      const hf = plan.hospitalFeatures;
      
      // Max patients per month
      if (hf.maxPatientsPerMonth !== null && hf.maxPatientsPerMonth !== undefined) {
        if (hf.maxPatientsPerMonth === -1) {
          features.push('Unlimited patients per month');
        } else {
          features.push(`Up to ${hf.maxPatientsPerMonth} patients per month`);
        }
      }
      
      // Max assignments per month
      if (hf.maxAssignmentsPerMonth !== null && hf.maxAssignmentsPerMonth !== undefined) {
        if (hf.maxAssignmentsPerMonth === -1) {
          features.push('Unlimited assignments per month');
        } else {
          features.push(`Up to ${hf.maxAssignmentsPerMonth} assignments per month`);
        }
      }
      
      // Premium doctors access
      if (hf.includesPremiumDoctors) {
        features.push('Access to premium doctors');
      }
      
      // Notes (can contain additional features)
      if (hf.notes) {
        const noteFeatures = hf.notes.split(/\n|,|;/).filter(n => n.trim());
        features.push(...noteFeatures.map(n => n.trim()));
      }
    } else {
      // Fallback to tier-based features if no database features
      switch (plan.tier) {
        case 'free':
          features.push(
            'Basic hospital registration',
            'Add up to 10 patients/month',
            'Access to all doctors',
            'Standard listing',
            'Community support'
          );
          break;
        case 'basic':
          features.push(
            'Enhanced visibility',
            'Up to 50 patients per month',
            'Priority placement',
            'Email support'
          );
          break;
        case 'premium':
          features.push(
            'Unlimited patients',
            'Unlimited assignments',
            'Premium hospital listing',
            'Priority support (24/7)'
          );
          break;
      }
    }
    
    return features.length > 0 ? features : ['Standard features'];
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'border-gray-300 bg-white';
      case 'basic':
        return 'border-yellow-400 bg-yellow-50';
      case 'premium':
        return 'border-purple-500 bg-purple-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  const currentPlanId = currentSubscription?.plan?.id;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-gray-900 mb-2 text-2xl font-bold">Subscriptions</h1>
        <p className="text-gray-600">Manage your subscription plans and view history</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setShowPlans(false)}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              !showPlans
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            Subscription History
          </button>
          <button
            onClick={() => setShowPlans(true)}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              showPlans
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4" />
            Available Plans
          </button>
        </nav>
      </div>

      {/* Subscription History View */}
      {!showPlans && (
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : subscriptionHistory.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No subscription history</h3>
              <p className="text-gray-600">You haven't had any subscriptions yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subscriptionHistory.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {sub.plan?.name || 'N/A'}
                          </div>
                          {sub.description && (
                            <div className="text-xs text-gray-500 mt-1">{sub.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              sub.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : sub.status === 'expired'
                                ? 'bg-gray-100 text-gray-800'
                                : sub.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(sub.startDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            to {new Date(sub.endDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {sub.payment ? (
                            <div className="text-sm font-medium text-gray-900">
                              {sub.payment.currency === 'INR' ? '₹' : '$'}
                              {Number(sub.payment.amount || 0).toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Free</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {sub.subscriptionType === 'billing_cycle_change' && (
                              <span className="text-blue-600">Billing Cycle Change</span>
                            )}
                            {sub.subscriptionType === 'upgrade' && (
                              <span className="text-green-600">Upgrade</span>
                            )}
                            {sub.subscriptionType === 'new' && (
                              <span className="text-gray-600">New Subscription</span>
                            )}
                          </div>
                          {sub.pricing && (
                            <div className="text-xs text-gray-500 mt-1">
                              {sub.pricing.billingCycle || `${sub.pricing.billingPeriodMonths} months`}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plans View */}
      {showPlans && (
        <>
          {/* Current Plan Display */}
          {currentSubscription && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Current Plan</h3>
                <p className="text-2xl font-bold text-blue-600">{currentSubscription.plan.name}</p>
                <div className="mt-2 space-y-1">
                  {currentSubscription.plan.tier === 'free' ? (
                    <p className="text-sm text-gray-600">Free Forever</p>
                  ) : (
                    <>
                      {currentSubscription.priceAtPurchase && (
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Price: </span>
                          {currentSubscription.currencyAtPurchase === 'INR' ? '₹' : '$'}
                          {Number(currentSubscription.priceAtPurchase || 0).toLocaleString()}
                          {currentSubscription.billingCycle && (
                            <span className="text-gray-600">
                              {' '}/ {currentSubscription.billingCycle === 'monthly' ? 'month' : 
                                      currentSubscription.billingCycle === 'quarterly' ? 'quarter' :
                                      currentSubscription.billingCycle === 'yearly' ? 'year' :
                                      `${currentSubscription.billingPeriodMonths || 1} months`}
                            </span>
                          )}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        {currentSubscription.status === 'active' ? 'Expires on' : 'Expired on'} {new Date(currentSubscription.endDate).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right ml-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentSubscription.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {currentSubscription.status}
                </span>
              </div>
            </div>
          </div>

          </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const isPopular = plan.tier === 'basic' || plan.tier === 'premium';
          const features = getPlanFeatures(plan);
          const pricingOptions = plan.pricingOptions || [];
          const defaultPricing = pricingOptions.find(p => p.billingCycle === 'monthly') || pricingOptions[0];
          const selectedPricingId = selectedPricing[plan.id] || defaultPricing?.id;
          const selectedPricingOption = pricingOptions.find(p => p.id === selectedPricingId);

          return (
            <div
              key={plan.id}
              className={`relative rounded-lg border-2 p-6 ${getTierColor(plan.tier)} ${
                isPopular ? 'shadow-lg' : 'shadow'
              } ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-semibold">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {plan.tier === 'premium' && (
                <div className="absolute top-4 right-4">
                  <Crown className="w-6 h-6 text-yellow-500" />
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                {plan.tier === 'free' ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">Free</span>
                  </div>
                ) : pricingOptions.length > 0 ? (
                  <div>
                    {pricingOptions.length > 1 ? (
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Billing Cycle
                        </label>
                        <select
                          value={selectedPricingId || ''}
                          onChange={(e) => setSelectedPricing({ ...selectedPricing, [plan.id]: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {pricingOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.billingCycle.charAt(0).toUpperCase() + option.billingCycle.slice(1)} 
                              {option.billingPeriodMonths > 1 && ` (${option.billingPeriodMonths} months)`}
                              {option.discountPercentage > 0 && ` - Save ${option.discountPercentage}%`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {selectedPricingOption && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">
                          {selectedPricingOption.currency === 'INR' ? '₹' : '$'}
                          {Number(selectedPricingOption.price || 0).toLocaleString()}
                        </span>
                        <span className="text-gray-600">
                          /{selectedPricingOption.billingCycle === 'monthly' ? 'month' : 
                            selectedPricingOption.billingCycle === 'quarterly' ? 'quarter' :
                            selectedPricingOption.billingCycle === 'yearly' ? 'year' :
                            `${selectedPricingOption.billingPeriodMonths} months`}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-600">No pricing available</div>
                )}
              </div>

              {/* Features List */}
              <ul className="space-y-3 mb-6">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              {(() => {
                // Check if this is the current plan
                const isCurrentPlan = plan.id === currentPlanId;
                
                // Check if user selected a different pricing option than current
                const currentPricingId = currentSubscription?.plan?.pricingOptions?.find(
                  (p: PricingOption) => p.billingCycle === currentSubscription.billingCycle
                )?.id || currentSubscription?.pricingId;
                const isDifferentPricing = isCurrentPlan && selectedPricingId && selectedPricingId !== currentPricingId;
                
                // If it's the current plan and same pricing, show "Current Plan"
                if (isCurrentPlan && !isDifferentPricing) {
                  return (
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-600 py-3 rounded-lg font-semibold cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  );
                }
                
                // For current plan with different pricing, or different plan
                const isUpgradePlan = currentSubscription 
                  ? isUpgrade(currentSubscription.plan.tier, plan.tier)
                  : false;
                
                let buttonText = 'Select Plan';
                if (isCurrentPlan && isDifferentPricing) {
                  buttonText = 'Change Billing Cycle';
                } else if (plan.tier === 'free') {
                  buttonText = 'Select Free Plan';
                } else if (isUpgradePlan) {
                  buttonText = 'Upgrade Now';
                } else {
                  buttonText = 'Change Plan';
                }
                
                return (
                  <button
                    onClick={() => handleUpgrade(plan.id, selectedPricingId)}
                    disabled={upgrading === plan.id || (plan.tier !== 'free' && !selectedPricingId)}
                    className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
                      plan.tier === 'free'
                        ? 'bg-gray-600 hover:bg-gray-700'
                        : plan.tier === 'basic'
                        ? 'bg-yellow-500 hover:bg-yellow-600'
                        : 'bg-purple-600 hover:bg-purple-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {upgrading === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      buttonText
                    )}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Why Upgrade Section */}
      {currentSubscription && currentSubscription.plan.tier === 'free' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Why Upgrade?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">More Patients</p>
                <p className="text-sm text-gray-600">Attract more patients with premium visibility</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Priority Access</p>
                <p className="text-sm text-gray-600">Get priority access to premium doctors</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Advanced Analytics</p>
                <p className="text-sm text-gray-600">Track performance with detailed insights</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Priority Support</p>
                <p className="text-sm text-gray-600">Get help when you need it most</p>
              </div>
            </div>
          </div>
        </div>
          )}
        </>
      )}
    </div>
  );
}
























