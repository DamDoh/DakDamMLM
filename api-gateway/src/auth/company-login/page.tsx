'use client';

import { Suspense } from 'react';
import { CompanyProvider } from '@/context/company-context';
import CompanyLogin from '@/components/company/company-login';
import { Loader2 } from 'lucide-react';

function CompanyLoginContent() {
  return <CompanyLogin />;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-12 w-12 animate-spin" />
      <p className="ml-4 text-lg">Loading company login...</p>
    </div>
  );
}

export default function CompanyLoginPage() {
  return (
    <CompanyProvider>
      <Suspense fallback={<LoadingFallback />}>
        <CompanyLoginContent />
      </Suspense>
    </CompanyProvider>
  );
}