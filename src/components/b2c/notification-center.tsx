'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  ShoppingCart,
  DollarSign,
  UserPlus,
  Settings,
  X,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';
import { format } from 'date-fns';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  type: 'order' | 'commission' | 'system' | 'achievement' | 'alert';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  link?: string;
  data?: any;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const { t } = useI18n();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const notifs: NotificationItem[] = Array.isArray(result) ? result : result.data ?? [];

        // Transform notifications to our format
        const formattedNotifications = notifs.map(notif => ({
          id: notif.id,
          type: notif.category === 'order' ? 'order' :
                notif.category === 'commission' ? 'commission' :
                notif.category === 'achievement' ? 'achievement' :
                notif.category === 'alert' ? 'alert' : 'system',
          title: notif.title || 'Notification',
          message: notif.message || notif.description || '',
          isRead: notif.isRead || notif.read || false,
          createdAt: notif.createdAt,
          priority: notif.priority || 'medium',
          category: notif.category || 'system',
          link: notif.link || notif.data?.link,
          data: notif.data
        }));

        setNotifications(formattedNotifications);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read: true }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);

      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        toast({
          title: 'All notifications marked as read',
          description: `Marked ${unreadIds.length} notifications as read.`,
        });
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark notifications as read',
        variant: 'destructive',
      });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-4 w-4 text-blue-500" />;
      case 'commission':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'achievement':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50/50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50/50';
      case 'low':
      default:
        return 'border-l-gray-500 bg-gray-50/50';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (activeTab) {
      case 'unread':
        return !notification.isRead;
      case 'orders':
        return notification.type === 'order';
      case 'commissions':
        return notification.type === 'commission';
      case 'system':
        return notification.type === 'system' || notification.type === 'alert';
      case 'achievements':
        return notification.type === 'achievement';
      default:
        return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <Card className="relative w-full max-w-md h-[85vh] sm:h-[80vh] shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mx-3 sm:mx-4 mb-4 h-9">
              <TabsTrigger value="all" className="text-xs px-1 sm:px-2">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs px-1 sm:px-2">
                Unread ({unreadCount})
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-xs px-1 sm:px-2">
                Recent
              </TabsTrigger>
            </TabsList>

            <div className="px-4 pb-4">
              <ScrollArea className="h-[60vh] w-full">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <Bell className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Loading notifications...</p>
                    </div>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center p-8">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredNotifications.map((notification) => (
                      <Card
                        key={notification.id}
                        className={`border-l-4 cursor-pointer transition-all hover:shadow-md ${
                          getPriorityColor(notification.priority)
                        } ${!notification.isRead ? 'bg-blue-50/30' : ''}`}
                        onClick={() => !notification.isRead && markAsRead(notification.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>

                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className={`font-medium text-sm ${!notification.isRead ? 'font-semibold' : ''}`}>
                                  {notification.title}
                                </h4>
                                <div className="flex items-center gap-1 ml-2">
                                  {!notification.isRead && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notification.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>

                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{format(new Date(notification.createdAt), 'MMM dd, HH:mm')}</span>
                                <Badge variant="outline" className="text-xs">
                                  {notification.category}
                                </Badge>
                              </div>

                              {notification.link && (
                                <Button asChild size="sm" variant="outline" className="w-full mt-2">
                                  <Link href={notification.link}>
                                    View Details
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}</content>
<parameter name="filePath">C:\Users\V COMPUTER\Documents\dakdampostgre-devcg\dakdampostgre-devcg\src\components\b2c\notification-center.tsx