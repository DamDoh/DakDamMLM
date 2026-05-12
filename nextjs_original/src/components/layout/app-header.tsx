
'use client';

import { useEffect, useState } from 'react';
import { useGenealogyContext } from '@/context/genealogy-context';
import type { Notification } from '@/services/server-actions';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Bell, Search, HelpCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


export default function AppHeader() {
  const { rootMember } = useGenealogyContext() || {};
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    if (!rootMember) return;
    fetchNotifications();
  }, [rootMember]);

  const fetchNotifications = async () => {
    if (!rootMember) return;
    try {
      setNotifLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch(`/api/notifications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        const payload = await response.json();
        const notifs: Notification[] = Array.isArray(payload) ? payload : payload.data ?? [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: Notification) => !n.isRead).length);
      } else {
        console.error('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isRead: true }),
      });
      if (response.ok) {
        await fetchNotifications(); // Refresh notifications
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
  
  return (
    <div className="flex h-14 items-center justify-end gap-2 border-b bg-background px-4">
      <Button variant="ghost" size="icon" className="w-8 h-8" icon={Search}>
        <span className="sr-only">Search</span>
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative w-8 h-8">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 justify-center p-0">{unreadCount}</Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <div className="p-4 font-medium border-b">Notifications</div>
          <div className="max-h-80 overflow-y-auto">
            {isNotifLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline-block" /> Loading...</div>
            ) : notifications.length > 0 ? (
              notifications.map(notif => (
                <div key={notif.id} onClick={() => !notif.isRead && handleMarkAsRead(notif.id)} className={cn("p-4 border-b text-sm hover:bg-muted/50 cursor-pointer", !notif.isRead && "bg-primary/10")}>
                  <div className="font-semibold flex items-center justify-between">
                    {notif.title}
                    {!notif.isRead && <div className="h-2 w-2 rounded-full bg-primary"></div>}
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{notif.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(notif.createdDate), { addSuffix: true })}</p>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">No new notifications.</div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" className="w-8 h-8" icon={HelpCircle}>
        <span className="sr-only">Help</span>
      </Button>

      <LanguageSelector />
    </div>
  )
}
