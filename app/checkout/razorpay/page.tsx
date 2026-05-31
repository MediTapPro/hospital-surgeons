'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api/httpClient';
import { toast } from 'sonner';
import Link from 'next/link';

// Load Razorpay script dynamically
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

function RazorpayCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const planId = searchParams.get('planId');
  const userRole = searchParams.get('userRole') || 'doctor';
  const email = searchParams.get('email') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  useEffect(() => {
    if (!orderId) {
      setError('Order ID is required');
      setLoading(false);
      return;
    }

    initializeRazorpay();
  }, [orderId]);

  const initializeRazorpay = async () => {
    try {
      setLoading(true);

      // Step 1: Load Razorpay script from their CDN
      // This script adds window.Razorpay to the global scope
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay script');
      }

      // Step 2: Get Razorpay key from environment
      // Note: In production, you might want to fetch this from backend for security
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

      if (!razorpayKey) {
        throw new Error('Razorpay key not configured. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID');
      }

      // Step 3: Create Razorpay options
      // When you use order_id, Razorpay automatically fetches order details from their servers
      // So you don't need to set amount/currency manually - they come from the order
      const options = {
        key: razorpayKey, // Your Razorpay key ID
        order_id: orderId, // Order ID created on backend
        name: 'Hospital Surgeons',
        description: 'Subscription Payment',
        // Amount and currency are automatically fetched from the order
        handler: function (response: any) {
          // This function is called when payment is successful
          // response contains: razorpay_payment_id, razorpay_order_id, razorpay_signature
          handlePaymentSuccess(response);
        },
        prefill: {
          // Prefill customer details from URL params
          email: email || '',
        },
        theme: {
          color: '#2563eb', // Customize modal color
        },
        modal: {
          ondismiss: function() {
            // Called when user closes the modal without paying
            // Redirect based on user role from URL params
            if (userRole === 'hospital') {
              router.push(`/hospital/subscriptions${planId ? `?planId=${planId}` : ''}`);
            } else {
              router.push(`/doctor/subscriptions${planId ? `?planId=${planId}` : ''}`);
            }
          }
        }
      };

      // Step 5: Create Razorpay instance and open the modal
      // ============================================================
      // THIS IS WHERE THE RAZORPAY UI APPEARS!
      // ============================================================
      // When you call razorpay.open(), Razorpay does the following:
      // 1. Creates a modal overlay (dark background) on top of your page
      // 2. Displays a payment form inside the modal with:
      //    - Payment amount
      //    - Payment method options (Card, UPI, Net Banking, etc.)
      //    - Input fields for card details or UPI ID
      //    - Pay button
      // 3. The modal is fully managed by Razorpay - you don't need to style it
      // 4. When user completes payment, the 'handler' function is called
      // 5. If user closes modal, 'modal.ondismiss' is called
      // ============================================================
      const razorpay = new window.Razorpay(options);
      razorpay.open(); // <-- THIS LINE OPENS THE RAZORPAY UI MODAL (POPUP)

      setLoading(false);
    } catch (err: any) {
      console.error('Razorpay initialization error:', err);
      setError(err.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (response: any) => {
    try {
      setPaymentStatus('success');

      // Verify payment with backend
      // This endpoint verifies the payment signature and fetches payment details from Razorpay
      const verifyResponse = await apiClient.post('/api/payments/verify', {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });

      if (verifyResponse.data.success) {
        // Payment verified successfully
        // Redirect to success page with payment details
        // Use planId and userRole from URL params
        if (userRole === 'hospital') {
          router.push(`/hospital/subscriptions/payment/success?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}&planId=${planId || ''}`);
        } else {
          router.push(`/doctor/subscriptions/payment/success?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}&planId=${planId || ''}`);
        }
      } else {
        throw new Error(verifyResponse.data.error || 'Payment verification failed');
      }
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setPaymentStatus('failed');
      setError(err.message || 'Payment verification failed');
      toast.error('Payment verification failed. Please contact support.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Initializing Razorpay payment...</p>
          <p className="text-sm text-gray-500">Loading payment gateway...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-4">
            <Link
              href="/doctor/subscriptions"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              Back to Plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">Redirecting to success page...</p>
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  // This should not be visible as Razorpay modal should be open
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Processing payment...</p>
      </div>
    </div>
  );
}

export default function RazorpayCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <RazorpayCheckoutContent />
    </Suspense>
  );
}

