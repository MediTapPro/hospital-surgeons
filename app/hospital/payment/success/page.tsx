'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txnId = searchParams.get('txn') || 'TXN1762521503853';
  const planId = searchParams.get('plan') || 'gold';
  
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    if (txnId) {
      fetch(`/api/payments/${txnId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPaymentData(data.data);
          }
        });
    }
  }, [txnId]);

  const planDetails = {
    gold: { name: 'Gold Plan', amount: 5000 },
    platinum: { name: 'Platinum Plan', amount: 10000 },
  };

  const plan = planDetails[planId as keyof typeof planDetails] || planDetails.gold;
  const currentDate = new Date().toLocaleDateString('en-GB');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">Payment Successful!</h1>
        <p className="text-gray-600 text-center mb-8">Your subscription has been activated successfully</p>

        {/* Transaction Details */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-semibold text-gray-900">{txnId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Plan:</span>
              <span className="font-semibold text-gray-900">{plan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-semibold text-green-600">₹{plan.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-semibold text-gray-900">{currentDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Status:</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Confirmed
              </span>
            </div>
          </div>
        </div>

        {/* Benefits Activated */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Benefits Activated</h3>
          <ul className="space-y-3">
            {[
              'Priority listing enabled',
              'Enhanced visibility activated',
              'Advanced analytics unlocked',
              'Premium support access granted',
            ].map((benefit, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-700">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Link
            href="/hospital/dashboard"
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Dashboard
          </Link>
          <button className="w-full text-gray-700 py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Receipt
          </button>
        </div>

        {/* Support Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Need help? Contact our support team at</p>
          <a href="mailto:support@hospital-network.com" className="text-blue-600 font-medium">
            support@hospital-network.com
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}

