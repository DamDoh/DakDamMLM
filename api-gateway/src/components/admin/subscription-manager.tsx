'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CreditCard,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Crown,
  Star,
  Building
} from 'lucide-react';
import { useCompany } from '@/context/company-context';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    users: number;
    products: number;
    storage: number; // GB
    apiCalls: number; // per month
  };
  popular?: boolean;
}

interface CurrentSubscription {
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  usage: {
    users: number;
    products: number;
    storage: number;
    apiCalls: number;
  };
}

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small MLM companies just getting started',
    price: 99,
    currency: 'USD',
    interval: 'monthly',
    features: [
      'Up to 500 distributors',
      'Basic product catalog',
      'Standard commission rules',
      'Email support',
      'Basic reporting'
    ],
    limits: {
      users: 500,
      products: 50,
      storage: 5,
      apiCalls: 10000
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Ideal for growing MLM businesses with advanced features',
    price: 299,
    currency: 'USD',
    interval: 'monthly',
    features: [
      'Up to 2500 distributors',
      'Advanced product management',
      'Custom commission rules',
      'Priority support',
      'Advanced analytics',
      'API access',
      'Custom branding'
    ],
    limits: {
      users: 2500,
      products: 200,
      storage: 25,
      apiCalls: 50000
    },
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large-scale MLM operations with unlimited potential',
    price: 999,
    currency: 'USD',
    interval: 'monthly',
    features: [
      'Unlimited distributors',
      'Unlimited products',
      'Full customization',
      'White-label solution',
      'Dedicated support',
      'Advanced integrations',
      'Custom development',
      'SLA guarantee'
    ],
    limits: {
      users: -1, // unlimited
      products: -1, // unlimited
      storage: 100,
      apiCalls: 200000
    }
  }
];

export default function SubscriptionManager() {
  const { company } = useCompany();
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company) {
      loadSubscriptionData();
    }
  }, [company]);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      // This would be an API call to get subscription data
      const response = await fetch(`/api/company/${company!.id}/subscription`);
      if (response.ok) {
        const data = await response.json();
        setCurrentSubscription(data);
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      const response = await fetch(`/api/company/${company?.id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      if (response.ok) {
        // Handle successful upgrade
        loadSubscriptionData();
      }
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
    }
  };

  const getCurrentPlan = () => {
    return subscriptionPlans.find(plan => plan.id === currentSubscription?.planId);
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const formatLimit = (value: number) => {
    return value === -1 ? 'Unlimited' : value.toLocaleString();
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No company selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Subscription Management</h2>
          <p className="text-muted-foreground">Manage your company&apos;s subscription plan and billing</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <CreditCard className="h-4 w-4 mr-2" />
          {company.currency} Billing
        </Badge>
      </div>

      {/* Current Plan Overview */}
      {currentSubscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  Current Plan: {getCurrentPlan()?.name}
                </CardTitle>
                <CardDescription>
                  {getCurrentPlan()?.description}
                </CardDescription>
              </div>
              <Badge
                variant={currentSubscription.status === 'active' ? 'default' : 'destructive'}
                className="text-sm"
              >
                {currentSubscription.status === 'active' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertTriangle className="h-3 w-3 mr-1" />
                )}
                {currentSubscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Usage Stats */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Users</span>
                  <span>{currentSubscription.usage.users} / {formatLimit(getCurrentPlan()?.limits.users || 0)}</span>
                </div>
                <Progress
                  value={getUsagePercentage(currentSubscription.usage.users, getCurrentPlan()?.limits.users || 0)}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Products</span>
                  <span>{currentSubscription.usage.products} / {formatLimit(getCurrentPlan()?.limits.products || 0)}</span>
                </div>
                <Progress
                  value={getUsagePercentage(currentSubscription.usage.products, getCurrentPlan()?.limits.products || 0)}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Storage</span>
                  <span>{currentSubscription.usage.storage}GB / {getCurrentPlan()?.limits.storage}GB</span>
                </div>
                <Progress
                  value={(currentSubscription.usage.storage / (getCurrentPlan()?.limits.storage || 1)) * 100}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>API Calls</span>
                  <span>{currentSubscription.usage.apiCalls.toLocaleString()} / {getCurrentPlan()?.limits.apiCalls.toLocaleString()}</span>
                </div>
                <Progress
                  value={(currentSubscription.usage.apiCalls / (getCurrentPlan()?.limits.apiCalls || 1)) * 100}
                  className="h-2"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Next billing date: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Billing History
                </Button>
                <Button variant="outline" size="sm">
                  Update Payment Method
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {currentSubscription?.planId === plan.id && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="text-3xl font-bold">
                  {plan.currency} {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.interval}
                  </span>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={currentSubscription?.planId === plan.id ? 'secondary' : 'default'}
                  disabled={currentSubscription?.planId === plan.id}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {currentSubscription?.planId === plan.id ? 'Current Plan' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>View your past invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No billing history available
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}