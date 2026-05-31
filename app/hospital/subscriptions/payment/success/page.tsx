'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Download, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api/httpClient';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = searchParams.get('txn');
  const paymentId = searchParams.get('payment_id');
  const orderId = searchParams.get('order_id');
  const planId = searchParams.get('planId');

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!transactionId && !paymentId) {
      router.push('/hospital/subscriptions');
      return;
    }

    // planId is optional - we can still show success page without it
    fetchDetails();
  }, [transactionId, paymentId, orderId, planId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);

      // Fetch plan details
      if (planId && planId !== 'null' && planId !== 'undefined') {
        console.log('Fetching plan with ID:', planId);
        try {
          const planResponse = await apiClient.get(`/api/subscriptions/plans/${planId}`);
          console.log('Plan response:', planResponse.data);
          if (planResponse.data.success) {
            setPlan(planResponse.data.data);
          } else {
            console.error('Plan fetch failed:', planResponse.data.message);
          }
        } catch (planError: any) {
          console.error('Error fetching plan:', {
            message: planError.message,
            response: planError.response?.data,
            status: planError.response?.status,
            url: planError.config?.url
          });
          // Continue even if plan fetch fails - we can still show payment success
        }
      } else {
        console.warn('PlanId is missing or invalid:', planId);
        // Try to get plan from subscription if available
      }

      // Fetch updated subscription
      try {
        const subscriptionResponse = await apiClient.get('/api/subscriptions/current');
        if (subscriptionResponse.data.success && subscriptionResponse.data.data) {
          const subscriptionData = subscriptionResponse.data.data;
          if (subscriptionData && subscriptionData.subscription) {
            setSubscription(subscriptionData.subscription);
          }
        }
      } catch (subError: any) {
        console.error('Error fetching subscription:', subError);
        // Continue even if subscription fetch fails
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // Get price from subscription (price_at_purchase) or fallback to plan pricing
  const priceAtPurchase = subscription?.priceAtPurchase || subscription?.price_at_purchase;
  const currencyAtPurchase = subscription?.currencyAtPurchase || subscription?.currency_at_purchase || 'INR';
  const priceInDollars = priceAtPurchase ? Number(priceAtPurchase) : Number(plan?.pricingOptions?.[0]?.price || 0);
  
  const renewalDate = subscription?.endDate
    ? new Date(subscription.endDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-8">
            Your subscription has been activated successfully.
          </p>

          {/* Transaction Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h2>
            <div className="space-y-3">
              {transactionId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID</span>
                  <span className="font-mono text-sm text-gray-900">{transactionId}</span>
                </div>
              )}
              {paymentId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment ID</span>
                  <span className="font-mono text-sm text-gray-900">{paymentId}</span>
                </div>
              )}
              {orderId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Order ID</span>
                  <span className="font-mono text-sm text-gray-900">{orderId}</span>
                </div>
              )}
              {plan && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-semibold text-gray-900">{plan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount Paid</span>
                    <span className="font-semibold text-gray-900">
                      {currencyAtPurchase === 'INR' ? '₹' : '$'}{priceInDollars.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
              {renewalDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Renewal Date</span>
                  <span className="font-semibold text-gray-900">{renewalDate}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* What's Next */}
          {plan && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What's Next?</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>Your {plan.name} plan is now active</span>
                </li>
                {plan.tier === 'basic' && (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>Enhanced patient management capabilities</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>Priority access to premium doctors</span>
                    </li>
                  </>
                )}
                {plan.tier === 'premium' && (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>Unlimited patient additions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>Top priority doctor access</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>Advanced analytics & insights</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>Priority 24/7 support</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/hospital/subscriptions"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              View Subscription
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/hospital/dashboard"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>

          {/* Note */}
          <p className="text-xs text-gray-500 mt-6">
            A confirmation email has been sent to your registered email address.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}



