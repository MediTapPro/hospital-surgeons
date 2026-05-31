'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(
  () => import('swagger-ui-react').then((mod) => mod.default),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Swagger UI...</p>
        </div>
      </div>
    )
  }
);

import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Suppress the UNSAFE_componentWillReceiveProps warning from swagger-ui-react
    // This is a known issue with the third-party library (multiple components use deprecated lifecycle methods)
    const originalError = console.error;
    console.error = (...args: any[]) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('UNSAFE_componentWillReceiveProps') &&
        args[0].includes('strict mode')
      ) {
        // Suppress all UNSAFE_componentWillReceiveProps warnings from swagger-ui-react
        // These come from various components like ParameterRow, RequestBodyEditor, etc.
        return;
      }
      originalError.apply(console, args);
    };

    // Fetch the Swagger spec from the API
    fetch('/api/docs')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch API documentation');
        }
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    // Restore original console.error on unmount
    return () => {
      console.error = originalError;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading API Documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-2xl mx-auto p-8">
          <h1 className="text-3xl font-bold mb-4 text-red-600">Error Loading Documentation</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a 
            href="/api/docs" 
            target="_blank"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            View API Spec (JSON)
          </a>
        </div>
      </div>
    );
  }

  if (!spec) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI spec={spec} />
    </div>
  );
}


































