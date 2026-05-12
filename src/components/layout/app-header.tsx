
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGenealogyContext } from '@/context/genealogy-context';
import type { Notification } from '@/services/server-actions';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LanguageSelector } from '@/components/ui/language-selector';
import { Bell, Search, HelpCircle, Loader2, BookOpen, MessageCircle, Phone, Mail, ExternalLink, ChevronRight, Info, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/lib/internationalization';


export default function AppHeader() {
  const router = useRouter();
  const { rootMember, handleSearch, isSearching, members, userId } = useGenealogyContext() || {};
  const { toast } = useToast();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifLoading, setNotifLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [isHelpPopoverOpen, setIsHelpPopoverOpen] = useState(false);
  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!rootMember) {
      setNotifLoading(false);
      return;
    }
    
    // Prevent multiple simultaneous requests
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setNotifLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      // Don't fetch if no token
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        setNotifLoading(false);
        isFetchingRef.current = false;
        return;
      }
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(`/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store', // Prevent caching to ensure fresh data
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const payload = await response.json();
          // Handle both array response and object with data property
          const notifs: Notification[] = Array.isArray(payload) 
            ? payload 
            : (payload.data ?? []);
          
          // Use unreadCount from API if available, otherwise calculate from notifications
          const apiUnreadCount = payload.unreadCount ?? notifs.filter((n: Notification) => !n.isRead).length;
          
          setNotifications(notifs);
          setUnreadCount(apiUnreadCount);
        } else {
          // Get error details from response
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          
          // Handle 401 (Unauthorized) silently - token expired/invalid is expected
          if (response.status === 401) {
            setNotifications([]);
            setUnreadCount(0);
            // Don't show toast for auth errors - user will be redirected to login
          } else if (response.status === 429) {
            // Rate limited - silently handle, will retry on next interval
            console.debug('Rate limited on notifications, will retry later');
          } else {
            // Show toast for other errors
            toast({
              variant: 'destructive',
              title: t('notifications.failedToLoad'),
              description: errorData.message || t('notifications.failedToLoadDesc'),
            });
            setNotifications([]);
            setUnreadCount(0);
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Handle abort/timeout
        if (fetchError.name === 'AbortError') {
          console.warn('Notification fetch timeout');
          setNotifications([]);
          setUnreadCount(0);
          return;
        }
        throw fetchError; // Re-throw other errors
      }
    } catch (error) {
      // Only show toast for unexpected errors, not network/auth errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('token') && !errorMessage.includes('Unauthorized') && !errorMessage.includes('abort')) {
        toast({
          variant: 'destructive',
          title: t('notifications.errorLoading'),
          description: t('notifications.errorLoadingDesc'),
        });
      }
      // Set empty arrays on error to prevent UI issues
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotifLoading(false);
      isFetchingRef.current = false;
    }
  }, [rootMember, toast, t]);

  // Fetch notifications on mount and when rootMember changes
  useEffect(() => {
    fetchNotifications();
    
    // Set up polling every 60 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const performSearch = () => {
    if (!searchQuery.trim() || !members || !userId) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    setShowResults(true);

    // Get all descendants of the current user
    const getDescendants = (rootId: string): string[] => {
      const descendants: string[] = [];
      const traverse = (id: string | null) => {
        if (!id) return;
        descendants.push(id);
        const member = members.find(m => m.id === id);
        if (member) {
          traverse(member.children.left);
          traverse(member.children.right);
        }
      };
      traverse(rootId);
      return descendants;
    };

    const descendants = getDescendants(userId);

    // Search for matching members
    const results = members.filter((member) => {
      if (!descendants.includes(member.id)) return false;
      
      return (
        member.memberId.toLowerCase().includes(query) ||
        (member.email && member.email.toLowerCase().includes(query)) ||
        (member.phoneNumber && member.phoneNumber.includes(query)) ||
        member.fullName.toLowerCase().includes(query)
      );
    });

    setSearchResults(results);

    // If exact match found, navigate to it
    const exactMatch = results.find(
      (m) =>
        m.memberId.toLowerCase() === query ||
        (m.email && m.email.toLowerCase() === query) ||
        (m.phoneNumber && m.phoneNumber === query)
    );

    if (exactMatch && handleSearch) {
      // Small delay to show results first
      setTimeout(() => {
        handleSearch(exactMatch.memberId);
      }, 300);
    } else if (results.length === 0 && handleSearch) {
      // Show toast if no results
      toast({
        variant: 'destructive',
        title: t('searchMembers.noMembersFound'),
        description: t('searchMembers.noMemberFoundMatching', { query: searchQuery || '' }),
      });
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
    <div className="flex h-10 md:h-14 items-center justify-end gap-1 md:gap-2 bg-background px-2 md:px-4">
      <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Search className="h-4 w-4" />
            <span className="sr-only">{t('searchMembers.srOnly')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[95vw] sm:w-96 p-0">
          <div className="p-4 border-b">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                performSearch();
              }}
              className="space-y-2"
            >
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('searchMembers.title')}
              </label>
              <div className="flex items-center gap-2">
          <input
            type="text"
                  placeholder={t('searchMembers.placeholder')}
                  className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                  disabled={isSearching}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!searchQuery.trim() || isSearching}
                  className="shrink-0"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isSearching && (
              <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('searchMembers.searching')}</span>
              </div>
            )}

            {!isSearching && showResults && searchResults.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                  {t('searchMembers.foundResults', { count: searchResults.length.toString(), plural: searchResults.length > 1 ? 's' : '' })}
                </p>
                <div className="space-y-1">
                  {searchResults.map((member) => (
                    <div
                      key={member.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        // Close popover immediately
                        setShowResults(false);
                        setIsSearchPopoverOpen(false);

                        const targetUrl = `/binary?id=${member.id}`;

                        // If we're already on the binary page, use handleSearch if available
                        if (handleSearch && typeof window !== 'undefined' && window.location.pathname === '/binary') {
                          handleSearch(member.memberId);
                        } else {
                          // Navigate to genealogy page with member ID
                          router.push(targetUrl);
                        }
                      }}
                      className="p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{member.fullName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {t('searchMembers.memberId')} {member.memberId}
                            </span>
                            {member.email && (
                              <span className="text-xs text-muted-foreground">• {member.email}</span>
                            )}
                            {member.phoneNumber && (
                              <span className="text-xs text-muted-foreground">• {member.phoneNumber}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isSearching && showResults && searchResults.length === 0 && searchQuery.trim() && (
              <div className="p-4 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">{t('searchMembers.noMembersFound')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('searchMembers.noMemberFoundMatching', { query: searchQuery || '' })}
                </p>
              </div>
            )}

            {!showResults && !isSearching && (
              <div className="p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">{t('searchMembers.searchBy')}</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{t('searchMembers.memberIdExample')}</li>
                  <li>{t('searchMembers.emailAddress')}</li>
                  <li>{t('searchMembers.phoneNumber')}</li>
                </ul>
                <p className="mt-3 text-xs">
                  {t('searchMembers.enterSearchTerm')}
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={isNotificationPopoverOpen} onOpenChange={setIsNotificationPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative w-8 h-8 md:w-8 md:h-8">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 justify-center p-0 text-xs">{unreadCount}</Badge>
            )}
            <span className="sr-only">{t('notifications.srOnly')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[95vw] sm:w-80 p-0">
          <div className="p-4 font-medium border-b flex items-center justify-between">
            <span>{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={isMarkingAllRead}
                onClick={async (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    setIsMarkingAllRead(true);
                    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                    const response = await fetch('/api/notifications', {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ action: 'mark-all-read' }),
                    });
                    if (response.ok) {
                      const result = await response.json();
                      await fetchNotifications(); // Refresh notifications
                      toast({
                        title: 'All notifications marked as read',
                        description: result.message || `Marked ${result.updatedCount || 0} notification(s) as read.`,
                      });
                    } else if (response.status === 429) {
                      const errorData = await response.json().catch(() => ({}));
                      toast({
                        variant: 'destructive',
                        title: 'Too many requests',
                        description: errorData.message || 'Please wait a moment and try again.',
                      });
                    } else {
                      const errorData = await response.json().catch(() => ({}));
                      toast({
                        variant: 'destructive',
                        title: 'Failed to mark all as read',
                        description: errorData.message || errorData.error || 'An error occurred. Please try again.',
                      });
                    }
                  } catch (error) {
                    console.error('Error marking all notifications as read:', error);
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: 'Failed to mark all notifications as read. Please try again.',
                    });
                  } finally {
                    setIsMarkingAllRead(false);
                  }
                }}
              >
                {isMarkingAllRead ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Marking...
                  </>
                ) : (
                  'Mark all as read'
                )}
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {isNotifLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline-block" /> {t('notifications.loading')}</div>
            ) : notifications.length > 0 ? (
              notifications.map(notif => {
                const notificationData = (notif as any).data as Record<string, any> | undefined;
                const link = notificationData?.link;
                const requestId = notificationData?.requestId;
                const handleClick = () => {
                  if (!notif.isRead) {
                    handleMarkAsRead(notif.id);
                  }
                  // Close the popover before navigation
                  setIsNotificationPopoverOpen(false);
                  
                  // Determine redirect link based on notification type/category
                  let redirectLink = link;
                  
                  if (!redirectLink) {
                    // Default redirects based on notification category/type
                    const category = (notif as any).category?.toLowerCase() || '';
                    const type = (notif as any).type?.toLowerCase() || '';
                    
                    if (category.includes('commission') || type.includes('commission')) {
                      redirectLink = '/commission';
                    } else if (category.includes('order') || type.includes('order')) {
                      redirectLink = '/orders';
                    } else if (category.includes('stock') || type.includes('stock')) {
                      redirectLink = '/my-stock';
                    } else if (category.includes('pv') || type.includes('pv')) {
                      redirectLink = '/ecash';
                    } else if (category.includes('ecash') || type.includes('ecash')) {
                      redirectLink = '/ecash';
                    } else {
                      redirectLink = '/dashboard'; // Default fallback
                    }
                  }
                  
                  if (redirectLink) {
                    // Navigate to the link using Next.js router
                    router.push(redirectLink);
                  }
                };
                return (
                  <div 
                    key={notif.id} 
                    onClick={handleClick} 
                    className={cn("p-4 border-b text-sm hover:bg-muted/50 cursor-pointer transition-colors", !notif.isRead && "bg-primary/10")}
                  >
                    <div className="font-semibold flex items-center justify-between">
                      {notif.title}
                      {!notif.isRead && <div className="h-2 w-2 rounded-full bg-primary"></div>}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{notif.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(notif.createdDate), { addSuffix: true })}</p>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">{t('notifications.noNewNotifications')}</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      <Popover open={isHelpPopoverOpen} onOpenChange={setIsHelpPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="w-8 h-8 md:w-8 md:h-8">
            <HelpCircle className="h-4 w-4" />
            <span className="sr-only">{t('help.srOnly')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[95vw] sm:w-96 p-0">
          <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">{t('help.title')}</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{t('help.description')}</p>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">

            {/* Common Questions */}
            <div className="p-4 border-b">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">{t('help.frequentlyAskedQuestions')}</h4>
              </div>
              <div className="space-y-2">
                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push('/auth/forgot-password');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push('/auth/forgot-password');
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary active:bg-muted"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{t('help.cantLoginTitle')}</p>
                      <p className="text-xs text-muted-foreground">{t('help.cantLoginDesc')}</p>
                    </div>
                  </div>
                </div>
                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Close help popover and open search popover
                    setIsHelpPopoverOpen(false);
                    // Use setTimeout to ensure the help popover closes first
                    setTimeout(() => {
                      setIsSearchPopoverOpen(true);
                    }, 100);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsHelpPopoverOpen(false);
                      setTimeout(() => {
                        setIsSearchPopoverOpen(true);
                      }, 100);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary active:bg-muted"
                >
                  <div className="flex items-start gap-2">
                    <Search className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{t('help.howToFindMemberTitle')}</p>
                      <p className="text-xs text-muted-foreground">{t('help.howToFindMemberDesc')}</p>
                    </div>
                  </div>
                </div>
                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Close help popover
                    setIsHelpPopoverOpen(false);
                    // Open email client with pre-filled subject
                    try {
                      window.location.href = 'mailto:support@company.com?subject=E-Cash Transfer Failed&body=Please describe your E-Cash transfer issue here:';
                      toast({
                        title: 'Opening Email',
                        description: 'Your email client should open. If not, please contact support@company.com',
                      });
                    } catch (error) {
                      toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: 'Could not open email client. Please contact support@company.com manually.',
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsHelpPopoverOpen(false);
                      try {
                        window.location.href = 'mailto:support@company.com?subject=E-Cash Transfer Failed&body=Please describe your E-Cash transfer issue here:';
                        toast({
                          title: 'Opening Email',
                          description: 'Your email client should open. If not, please contact support@company.com',
                        });
                      } catch (error) {
                        toast({
                          variant: 'destructive',
                          title: 'Error',
                          description: 'Could not open email client. Please contact support@company.com manually.',
                        });
                      }
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary active:bg-muted"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{t('help.ecashTransferFailedTitle')}</p>
                      <p className="text-xs text-muted-foreground">{t('help.ecashTransferFailedDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Options */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">{t('help.getSupport')}</h4>
              </div>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 h-auto py-3"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsHelpPopoverOpen(false);
                    // User guide page coming soon - show helpful message
                    toast({
                      title: 'User Guide',
                      description: 'User guide documentation is coming soon. Check the FAQ section above or contact support for assistance.',
                      duration: 5000,
                    });
                  }}
                >
                  <BookOpen className="h-4 w-4" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{t('help.userGuide')}</p>
                    <p className="text-xs text-muted-foreground">{t('help.userGuideDesc')}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 h-auto py-3"
                  onClick={() => window.location.href = 'mailto:support@company.com'}
                >
                  <Mail className="h-4 w-4" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{t('help.emailSupport')}</p>
                    <p className="text-xs text-muted-foreground">{t('help.emailSupportDesc')}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 h-auto py-3"
                  onClick={() => window.location.href = 'tel:+18001234567'}
                >
                  <Phone className="h-4 w-4" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{t('help.phoneSupport')}</p>
                    <p className="text-xs text-muted-foreground">{t('help.phoneSupportDesc')}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
              
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground text-center">
                  {t('help.contactSponsorTip')}
                </p>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {/* <Button variant="ghost" size="icon" className="w-8 h-8" icon={HelpCircle}>
        <span className="sr-only">Help</span>
      </Button> */}

      <LanguageSelector />
    </div>
  )
}
