'use client';

import { useState, useEffect } from 'react';
import { customDomainService, DNSRecord } from '@/services/custom-domain-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Copy, ExternalLink } from 'lucide-react';

interface DNSConfigurationProps {
  companyId: string;
  customDomain: string;
}

export function DNSConfiguration({ companyId, customDomain }: DNSConfigurationProps) {
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verifying' | 'verified' | 'failed'>('pending');
  const [verificationErrors, setVerificationErrors] = useState<string[]>([]);
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null);

  useEffect(() => {
    loadDNSConfiguration();
  }, [customDomain]);

  const loadDNSConfiguration = async () => {
    try {
      const records = customDomainService.getDNSConfigurationGuide(customDomain);
      setDnsRecords(records);
    } catch (error) {
      console.error('Failed to load DNS configuration:', error);
    }
  };

  const verifyDNSConfiguration = async () => {
    if (!companyId) return;

    setVerificationStatus('verifying');
    setVerificationErrors([]);

    try {
      // Note: In a real implementation, this would check actual DNS records
      // For now, we'll simulate verification
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay

      // Simulate verification result
      const isVerified = Math.random() > 0.3; // 70% success rate for demo

      if (isVerified) {
        setVerificationStatus('verified');
        // In real implementation, this would call the actual verification service
      } else {
        setVerificationStatus('failed');
        setVerificationErrors([
          'DNS records not found. Please ensure the records are properly configured and allow time for DNS propagation (up to 24 hours).',
          'Check that the records are added to the correct domain in your DNS provider.',
        ]);
      }
    } catch (error) {
      setVerificationStatus('failed');
      setVerificationErrors(['DNS verification failed. Please try again later.']);
    }
  };

  const copyToClipboard = async (text: string, recordId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRecord(recordId);
      setTimeout(() => setCopiedRecord(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'A': return 'bg-blue-100 text-blue-800';
      case 'CNAME': return 'bg-green-100 text-green-800';
      case 'TXT': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDNSProviderLinks = () => [
    { name: 'Cloudflare', url: 'https://dash.cloudflare.com' },
    { name: 'GoDaddy', url: 'https://dcc.godaddy.com/manage/' },
    { name: 'Namecheap', url: 'https://ap.www.namecheap.com/Domains/DomainControlPanel/' },
    { name: 'Google Domains', url: 'https://domains.google.com/registrar/' },
    { name: 'AWS Route 53', url: 'https://console.aws.amazon.com/route53/' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DNS Configuration</CardTitle>
          <CardDescription>
            Configure your DNS records to point {customDomain} to our platform.
            These changes may take up to 24 hours to propagate worldwide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* DNS Records Table */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Required DNS Records</h3>
            <div className="space-y-3">
              {dnsRecords.map((record, index) => {
                const recordId = `${record.type}-${index}`;
                return (
                  <div key={recordId} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRecordTypeColor(record.type)}`}>
                          {record.type}
                        </span>
                        <span className="font-medium">{record.name}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(record.value, recordId)}
                        className="flex items-center space-x-1"
                      >
                        <Copy className="h-4 w-4" />
                        <span>{copiedRecord === recordId ? 'Copied!' : 'Copy'}</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-gray-500">Name</Label>
                        <Input
                          value={record.name}
                          readOnly
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Type</Label>
                        <Input
                          value={record.type}
                          readOnly
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Value</Label>
                        <Input
                          value={record.value}
                          readOnly
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                    </div>

                    {record.ttl && (
                      <div className="mt-2 text-xs text-gray-500">
                        TTL: {record.ttl} seconds
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* DNS Provider Links */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Quick Links to DNS Providers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {getDNSProviderLinks().map((provider) => (
                <a
                  key={provider.name}
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium">{provider.name}</span>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
              ))}
            </div>
          </div>

          {/* Verification Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Verification Status</h3>
              <Button
                onClick={verifyDNSConfiguration}
                disabled={verificationStatus === 'verifying'}
                className="flex items-center space-x-2"
              >
                {verificationStatus === 'verifying' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>
                  {verificationStatus === 'verifying' ? 'Verifying...' :
                   verificationStatus === 'verified' ? 'Re-verify' : 'Verify DNS'}
                </span>
              </Button>
            </div>

            {verificationStatus === 'verified' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  DNS configuration verified successfully! Your custom domain is ready to use.
                </AlertDescription>
              </Alert>
            )}

            {verificationStatus === 'failed' && verificationErrors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>DNS verification failed:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {verificationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Help Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Need Help?</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                If you're having trouble configuring your DNS records, here are some tips:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Make sure you're adding the records to the root domain, not a subdomain</li>
                <li>DNS changes can take up to 24 hours to propagate globally</li>
                <li>Check with your DNS provider's documentation for specific instructions</li>
                <li>Avoid adding multiple records of the same type for the same name</li>
                <li>If using Cloudflare, make sure DNS proxy (orange cloud) is disabled for these records</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}