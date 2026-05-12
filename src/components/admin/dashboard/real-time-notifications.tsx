'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  RefreshCw,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';

interface Notification {
  id: string;
  type: 'alert' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'business' | 'system';
  acknowledged: boolean;
  createdAt: string;
  expiresAt?: string;
}

export function RealTimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: [] as string[],
    priority: [] as string[],
    category: [] as string[],
    showAcknowledged: false
  });
  const { toast } = useToast();
  const { t } = useI18n();

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const params = new URLSearchParams();
      if (filter.type.length > 0) params.set('type', filter.type.join(','));
      if (filter.priority.length > 0) params.set('priority', filter.priority.join(','));
      if (filter.category.length > 0) params.set('category', filter.category.join(','));
      if (filter.showAcknowledged) params.set('acknowledged', 'true');
      params.set('limit', '100');

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load notifications');
      }

      const result = await response.json();
      setNotifications(result.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeNotification = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'acknowledge',
          notificationId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge notification');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, acknowledged: true } : n
        )
      );

      toast({
        title: 'Success',
        description: 'Notification acknowledged',
      });
    } catch (error) {
      console.error('Failed to acknowledge notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge notification',
        variant: 'destructive',
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (!filter.showAcknowledged && n.acknowledged) return false;
    if (filter.type.length > 0 && !filter.type.includes(n.type)) return false;
    if (filter.priority.length > 0 && !filter.priority.includes(n.priority)) return false;
    if (filter.category.length > 0 && !filter.category.includes(n.category)) return false;
    return true;
  });

  const unacknowledgedCount = notifications.filter(n => !n.acknowledged).length;

  useEffect(() => {
    loadNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Real-Time Notifications
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unacknowledgedCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadNotifications}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter.showAcknowledged ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(prev => ({ ...prev, showAcknowledged: !prev.showAcknowledged }))}
            >
              Show Acknowledged
            </Button>
            <Button
              variant={filter.priority.includes('critical') ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(prev => ({
                ...prev,
                priority: prev.priority.includes('critical')
                  ? prev.priority.filter(p => p !== 'critical')
                  : [...prev.priority, 'critical']
              }))}
            >
              Critical
            </Button>
            <Button
              variant={filter.category.includes('security') ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(prev => ({
                ...prev,
                category: prev.category.includes('security')
                  ? prev.category.filter(c => c !== 'security')
                  : [...prev.category, 'security']
              }))}
            >
              Security
            </Button>
          </div>

          {/* Notifications List */}
          <ScrollArea className="h-96">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No notifications found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <Card key={notification.id} className={`p-4 ${notification.acknowledged ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {notification.category}
                          </Badge>
                          {notification.acknowledged && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.createdAt).toLocaleString()}
                          </span>
                          {!notification.acknowledged && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => acknowledgeNotification(notification.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\admin\dashboard\real-time-notifications.tsx