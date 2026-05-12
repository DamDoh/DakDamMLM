'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../../src/context/auth-context';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuthContext();
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  console.log('Auth state:', { user, loading, dbStatus });

  useEffect(() => {
    // Check database status
    const checkDbStatus = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setDbStatus(data.database?.connectionAvailable ? 'connected' : 'disconnected');
      } catch (error) {
        setDbStatus('disconnected');
      }
    };

    checkDbStatus();
  }, []);

  useEffect(() => {
    // Once loading is complete, decide where to redirect
    if (!loading) {
      const timer = setTimeout(() => {
        if (user) {
          // If user is authenticated, go to profile (safe route)
          router.replace('/profile');
        } else {
          // If user is not authenticated, go to login
          router.replace('/auth/login');
        }
      }, 2000); // Give user time to see the status

      return () => clearTimeout(timer);
    }
  }, [router, user, loading]);

  const getStatusMessage = () => {
    if (loading) return 'Loading Application...';
    if (dbStatus === 'disconnected') return 'Running in Demo Mode (Database unavailable)';
    return 'Application Ready - Redirecting...';
  };

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="h-12 w-12 animate-spin" />;
    if (dbStatus === 'disconnected') return <AlertCircle className="h-12 w-12 text-yellow-500" />;
    return <CheckCircle className="h-12 w-12 text-green-500" />;
  };

  // Show loading screen with status information
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        {getStatusIcon()}
        <p className="mt-4 text-lg font-medium">{getStatusMessage()}</p>

        {dbStatus === 'disconnected' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
            <p className="text-sm text-yellow-800">
              ⚠️ Database is not available. The application will run in demo mode with limited functionality.
              Some features may not work as expected.
            </p>
          </div>
        )}

        {user && (
          <p className="mt-2 text-sm text-gray-600">
            Logged in as: {user.fullName} ({user.memberId})
          </p>
        )}
      </div>
    </div>
  );
}
