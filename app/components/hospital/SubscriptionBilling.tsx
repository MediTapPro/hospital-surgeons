'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Check, Download, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import apiClient from '@/lib/api/httpClient';
import { toast } from 'sonner';
import { PageHeader } from '../../hospital/_components/PageHeader';

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

interface HospitalFeatures {
  id: string;
  planId: string;
  maxPatientsPerMonth: number | null;
  includesPremiumDoctors: boolean;
  maxAssignmentsPerMonth: number | null;
  notes: string | null;
}

interface Plan {
  id: string;
  name: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  userRole: string;
  pricingOptions?: PricingOption[];
  hospitalFeatures?: HospitalFeatures[];
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
  plan: Plan;
}

export function SubscriptionBilling() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectingPlan, setSelectingPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<Record<string, string>>({}); // planId -> pricingId

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get current user ID from token
      const token = localStorage.getItem('accessToken');
      if (token) {
        const { decodeToken } = await import('@/lib/auth/utils');
        const decoded = decodeToken(token);
        if (decoded) {
          setUserId(decoded.userId);
        }
      }

      // Fetch available plans for hospitals
      const plansResponse = await apiClient.get('/api/subscriptions/plans');
      if (plansResponse.data.success && plansResponse.data.data) {
        const hospitalPlans = plansResponse.data.data.filter(
          (plan: Plan) => plan.userRole === 'hospital'
        );
        setPlans(hospitalPlans);
      }

      // Check for active subscription
      const subscriptionResponse = await apiClient.get('/api/subscriptions/current');
      if (subscriptionResponse.data.success && subscriptionResponse.data.data) {
        const subscriptionData = subscriptionResponse.data.data;
        if (subscriptionData && subscriptionData.subscription && subscriptionData.plan) {
          const sub = subscriptionData.subscription;
          setCurrentSubscription({
            id: sub.id,
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
            billingCycle: sub.billingCycle || sub.billing_cycle,
            billingPeriodMonths: sub.billingPeriodMonths || sub.billing_period_months,
            priceAtPurchase: sub.priceAtPurchase || sub.price_at_purchase,
            currencyAtPurchase: sub.currencyAtPurchase || sub.currency_at_purchase,
            plan: subscriptionData.plan,
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string, pricingId?: string) => {
    if (!userId) {
      toast.error('User not found. Please login again.');
      router.push('/login');
      return;
    }

    try {
      setSelectingPlan(planId);
      
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
      } else {
        // Paid plan - need to select pricing option first
        if (!pricingId) {
          toast.error('Please select a billing cycle');
          setSelectingPlan(null);
          return;
        }

        // Find the selected pricing option
        const selectedPricingOption = plan.pricingOptions?.find((p: PricingOption) => p.id === pricingId);
        if (!selectedPricingOption) {
          throw new Error('Selected pricing option not found');
        }

        // Create checkout session and redirect to payment gateway
        try {
          const checkoutResponse = await apiClient.post('/api/payments/create-order', {
            planId: planId,
            pricingId: pricingId,
            gateway: 'razorpay',
          });

          if (checkoutResponse.data.success && checkoutResponse.data.data?.session?.checkoutData) {
            const orderStatus = checkoutResponse.data.data?.status || 'pending';
            const checkoutData = checkoutResponse.data.data.session.checkoutData;
            
            // Show status message based on order status
            if (orderStatus === 'pending') {
              toast.info('Order created. Redirecting to payment...');
            } else if (orderStatus === 'paid') {
              toast.success('Payment already processed!');
            } else if (orderStatus === 'failed') {
              toast.error('Previous payment failed. Please try again.');
            } else {
              toast.info(`Order status: ${orderStatus}`);
            }
            
            // Construct checkout URL from checkoutData
            const urlParams = new URLSearchParams({
              order_id: checkoutData.orderId,
            });
            if (checkoutData.planId) urlParams.set('planId', checkoutData.planId);
            if (checkoutData.userRole) urlParams.set('userRole', checkoutData.userRole);
            if (checkoutData.email) urlParams.set('email', checkoutData.email);
            const checkoutUrl = `/checkout/razorpay?${urlParams.toString()}`;
            
            // Redirect to payment gateway checkout
            window.location.href = checkoutUrl;
          } else {
            throw new Error('Failed to create checkout session');
          }
        } catch (checkoutError: any) {
          console.error('Checkout error:', checkoutError);
          toast.error(checkoutError.response?.data?.message || checkoutError.message || 'Failed to initiate checkout');
          setSelectingPlan(null);
        }
      }
    } catch (error: any) {
      console.error('Error selecting plan:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to select plan');
    } finally {
      setSelectingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-slate-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  // If no subscription, show plan selection
  if (!currentSubscription) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader 
          title="Choose Your Plan" 
          description="Select a subscription plan to get started"
        />
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Select a Plan to Continue
              </h2>
              <p className="text-slate-600">
                Choose the plan that best fits your hospital's needs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const isFree = plan.tier === 'free';
                const isPopular = plan.tier === 'basic' || plan.tier === 'premium';
                
                return (
                  <Card
                    key={plan.id}
                    className={`relative ${
                      isPopular ? 'border-2 border-teal-600 shadow-lg' : ''
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-teal-600 hover:bg-teal-600 text-white">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{plan.name}</span>
                        {plan.tier === 'premium' && (
                          <Crown className="w-5 h-5 text-yellow-600" />
                        )}
                      </CardTitle>
                      <div className="mt-4">
                        {isFree ? (
                          <span className="text-3xl font-bold text-slate-900">Free</span>
                        ) : plan.pricingOptions && plan.pricingOptions.length > 0 ? (
                          <div>
                            {plan.pricingOptions.length > 1 ? (
                              <div className="mb-3">
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                  Billing Cycle
                                </label>
                                <select
                                  value={selectedPricing[plan.id] || plan.pricingOptions[0].id}
                                  onChange={(e) => setSelectedPricing({ ...selectedPricing, [plan.id]: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                  {plan.pricingOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.billingCycle.charAt(0).toUpperCase() + option.billingCycle.slice(1)}
                                      {option.billingPeriodMonths > 1 && ` (${option.billingPeriodMonths} months)`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                            {(() => {
                              const selectedPricingId = selectedPricing[plan.id] || plan.pricingOptions[0].id;
                              const selectedOption = plan.pricingOptions.find(p => p.id === selectedPricingId) || plan.pricingOptions[0];
                              return (
                                <div>
                                  <span className="text-3xl font-bold text-slate-900">
                                    {selectedOption.currency === 'INR' ? '₹' : '$'}
                                    {Number(selectedOption.price || 0).toLocaleString()}
                                  </span>
                                  <span className="text-slate-500">
                                    {' '}/ {selectedOption.billingCycle === 'monthly' ? 'month' :
                                            selectedOption.billingCycle === 'quarterly' ? 'quarter' :
                                            selectedOption.billingCycle === 'yearly' ? 'year' :
                                            `${selectedOption.billingPeriodMonths} months`}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="text-3xl font-bold text-slate-900">Contact for pricing</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 mb-2">Features:</h3>
                          <ul className="space-y-2 text-sm">
                            {plan.hospitalFeatures && plan.hospitalFeatures.length > 0 ? (
                              plan.hospitalFeatures.map((feature, idx) => (
                                <div key={idx}>
                                  {feature.maxPatientsPerMonth !== null && (
                                    <li className="flex items-start gap-2">
                                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <span>
                                        {feature.maxPatientsPerMonth === -1 || feature.maxPatientsPerMonth === 0
                                          ? 'Unlimited patients per month'
                                          : `${feature.maxPatientsPerMonth} patients per month`}
                                      </span>
                                    </li>
                                  )}
                                  {feature.includesPremiumDoctors && (
                                    <li className="flex items-start gap-2">
                                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <span>Premium doctor access</span>
                                    </li>
                                  )}
                                  {feature.notes && (
                                    <li className="flex items-start gap-2">
                                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <span>{feature.notes}</span>
                                    </li>
                                  )}
                                </div>
                              ))
                            ) : (
                              // Fallback if no features in database
                              <>
                                <li className="flex items-start gap-2">
                                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <span>{plan.name} plan features</span>
                                </li>
                                {isFree && (
                                  <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span>Basic features included</span>
                                  </li>
                                )}
                              </>
                            )}
                          </ul>
                        </div>
                        <Button
                          onClick={() => {
                            const selectedPricingId = selectedPricing[plan.id] || (plan.pricingOptions && plan.pricingOptions[0]?.id);
                            handleSelectPlan(plan.id, selectedPricingId);
                          }}
                          disabled={selectingPlan === plan.id}
                          className={`w-full ${
                            isPopular
                              ? 'bg-teal-600 hover:bg-teal-700'
                              : isFree
                              ? 'bg-slate-600 hover:bg-slate-700'
                              : ''
                          }`}
                        >
                          {selectingPlan === plan.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : isFree ? (
                            'Select Free Plan'
                          ) : (
                            `Select ${plan.name} Plan`
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {plans.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <p className="text-slate-600">No plans available at the moment.</p>
                <p className="text-sm text-slate-500 mt-2">
                  Please contact support for assistance.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If subscription exists, show current plan details
  const plan = currentSubscription.plan;
  const isFree = plan.tier === 'free';

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Subscription & Billing" 
        description="Manage your subscription and payment details"
      />
      <div className="p-8">
        {/* Current Plan Overview */}
        <Card className="mb-8 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-900">Current Plan</CardTitle>
              <Badge
                className={
                  isFree
                    ? 'bg-slate-100 text-slate-800'
                    : plan.tier === 'premium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-teal-100 text-teal-800'
                }
              >
                {plan.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-slate-500 text-sm mb-1">Price</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {isFree ? (
                    'Free'
                  ) : currentSubscription.priceAtPurchase ? (
                    <>
                      {currentSubscription.currencyAtPurchase === 'INR' ? '₹' : '$'}
                      {Number(currentSubscription.priceAtPurchase || 0).toLocaleString()}
                      {currentSubscription.billingCycle && (
                        <span className="text-sm text-slate-500">
                          {' '}/ {currentSubscription.billingCycle === 'monthly' ? 'month' :
                                  currentSubscription.billingCycle === 'quarterly' ? 'quarter' :
                                  currentSubscription.billingCycle === 'yearly' ? 'year' :
                                  `${currentSubscription.billingPeriodMonths || 1} months`}
                        </span>
                      )}
                    </>
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-sm mb-1">Billing Period</p>
                <p className="text-slate-900">
                  {new Date(currentSubscription.startDate).toLocaleDateString()} -{' '}
                  {new Date(currentSubscription.endDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-sm mb-1">Status</p>
                <Badge
                  variant={
                    currentSubscription.status === 'active' ? 'default' : 'secondary'
                  }
                  className={
                    currentSubscription.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : ''
                  }
                >
                  {currentSubscription.status}
                </Badge>
              </div>
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/hospital/subscription')}
                >
                  Change Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const isCurrentPlan = p.id === plan.id;
              const isPopular = p.tier === 'basic' || p.tier === 'premium';
              
              return (
                <Card
                  key={p.id}
                  className={`bg-white ${
                    isPopular ? 'border-2 border-teal-600' : ''
                  } ${isCurrentPlan ? 'ring-2 ring-teal-500' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-teal-600 hover:bg-teal-600 text-white">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      {p.tier === 'premium' && <Crown className="w-5 h-5 text-yellow-600" />}
                    </CardTitle>
                    <div className="mt-4">
                      <span className="text-3xl font-bold text-slate-900">
                        {p.tier === 'free' ? 'Free' : (
                          p.pricingOptions && p.pricingOptions.length > 0
                            ? `₹${Number(p.pricingOptions[0].price || 0).toLocaleString()}`
                            : 'Contact Us'
                        )}
                      </span>
                      {p.tier !== 'free' && p.pricingOptions && p.pricingOptions.length > 0 && (
                        <span className="text-slate-500">/{p.pricingOptions[0].billingCycle}</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">Features:</h3>
                        <ul className="space-y-2 text-sm mb-4">
                          {p.hospitalFeatures && p.hospitalFeatures.length > 0 ? (
                            p.hospitalFeatures.map((feature, idx) => (
                              <div key={idx}>
                                {feature.maxPatientsPerMonth !== null && (
                                  <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span>
                                      {feature.maxPatientsPerMonth === -1 || feature.maxPatientsPerMonth === 0
                                        ? 'Unlimited patients per month'
                                        : `${feature.maxPatientsPerMonth} patients per month`}
                                    </span>
                                  </li>
                                )}
                                {feature.includesPremiumDoctors && (
                                  <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span>Premium doctor access</span>
                                  </li>
                                )}
                                {feature.notes && (
                                  <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span>{feature.notes}</span>
                                  </li>
                                )}
                              </div>
                            ))
                          ) : (
                            <li className="flex items-start gap-2">
                              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{p.name} plan features</span>
                            </li>
                          )}
                        </ul>
                      </div>
                      <Button
                        variant={isCurrentPlan ? 'outline' : 'default'}
                        className={`w-full ${
                          isCurrentPlan ? '' : 'bg-teal-600 hover:bg-teal-700'
                        }`}
                        disabled={isCurrentPlan || selectingPlan === p.id}
                        onClick={() => handleSelectPlan(p.id)}
                      >
                        {isCurrentPlan
                          ? 'Current Plan'
                          : selectingPlan === p.id
                          ? 'Processing...'
                          : `Switch to ${p.name}`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
