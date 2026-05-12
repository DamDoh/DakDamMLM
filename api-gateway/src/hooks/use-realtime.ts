/**
 * Real-Time React Hook
 *
 * Provides React integration for real-time WebSocket notifications
 * Created: 2025-11-20 (Enhancement)
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeEvent {
  type: 'commission' | 'genealogy' | 'notification' | 'system' | 'dashboard';
  userId: string;
  companyId?: string;
  data: any;
  timestamp: Date;
}

export interface UseRealtimeOptions {
  userId?: string;
  companyId?: string;
  token?: string;
  enabled?: boolean;
  autoConnect?: boolean;
}

export interface UseRealtimeReturn {
  socket: Socket | null;
  isConnected: boolean;
  lastEvent: RealtimeEvent | null;
  events: RealtimeEvent[];
  connect: () => void;
  disconnect: () => void;
  subscribeToCommissions: () => void;
  subscribeToGenealogy: () => void;
  subscribeToDashboard: () => void;
  unsubscribeFromCommissions: () => void;
  unsubscribeFromGenealogy: () => void;
  unsubscribeFromDashboard: () => void;
  clearEvents: () => void;
}

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    userId,
    companyId,
    token,
    enabled = true,
    autoConnect = true
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef<RealtimeEvent[]>([]);

  // Update events ref when events state changes
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const connect = useCallback(() => {
    if (!enabled || !userId || socketRef.current?.connected) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      auth: {
        token,
        userId,
        companyId
      },
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Real-time connected');

      // Join user-specific rooms
      socketInstance.emit('join', { userId, companyId });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Real-time disconnected');
    });

    // Handle different event types
    socketInstance.on('notification', (event: RealtimeEvent) => {
      setLastEvent(event);
      setEvents(prev => [...prev, event]);
    });

    socketInstance.on('commission-update', (event: RealtimeEvent) => {
      setLastEvent(event);
      setEvents(prev => [...prev, event]);
    });

    socketInstance.on('genealogy-update', (event: RealtimeEvent) => {
      setLastEvent(event);
      setEvents(prev => [...prev, event]);
    });

    socketInstance.on('dashboard-update', (event: RealtimeEvent) => {
      setLastEvent(event);
      setEvents(prev => [...prev, event]);
    });

    socketInstance.on('company-notification', (event: RealtimeEvent) => {
      setLastEvent(event);
      setEvents(prev => [...prev, event]);
    });

    socketInstance.on('system-announcement', (event: Omit<RealtimeEvent, 'userId'>) => {
      const systemEvent: RealtimeEvent = {
        ...event,
        userId: 'system'
      };
      setLastEvent(systemEvent);
      setEvents(prev => [...prev, systemEvent]);
    });

    socketInstance.on('leaderboard-update', (data: any) => {
      const leaderboardEvent: RealtimeEvent = {
        type: 'dashboard',
        userId,
        companyId,
        data,
        timestamp: new Date()
      };
      setLastEvent(leaderboardEvent);
      setEvents(prev => [...prev, leaderboardEvent]);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Real-time connection error:', error);
      setIsConnected(false);
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);
  }, [enabled, userId, companyId, token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  const subscribeToCommissions = useCallback(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('subscribe-commissions', userId);
    }
  }, [userId]);

  const subscribeToGenealogy = useCallback(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('subscribe-genealogy', userId);
    }
  }, [userId]);

  const subscribeToDashboard = useCallback(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('subscribe-dashboard', userId);
    }
  }, [userId]);

  const unsubscribeFromCommissions = useCallback(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('unsubscribe-commissions', userId);
    }
  }, [userId]);

  const unsubscribeFromGenealogy = useCallback(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('unsubscribe-genealogy', userId);
    }
  }, [userId]);

  const unsubscribeFromDashboard = useCallback(() => {
    if (socketRef.current && userId) {
      socketRef.current.emit('unsubscribe-dashboard', userId);
    }
  }, [userId]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && enabled && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, enabled, userId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    socket,
    isConnected,
    lastEvent,
    events,
    connect,
    disconnect,
    subscribeToCommissions,
    subscribeToGenealogy,
    subscribeToDashboard,
    unsubscribeFromCommissions,
    unsubscribeFromGenealogy,
    unsubscribeFromDashboard,
    clearEvents
  };
}

// Specialized hooks for specific use cases

export function useCommissionNotifications(userId?: string, options: Partial<UseRealtimeOptions> = {}) {
  const realtime = useRealtime({
    userId,
    ...options
  });

  useEffect(() => {
    if (realtime.isConnected) {
      realtime.subscribeToCommissions();
    }
  }, [realtime.isConnected, realtime.subscribeToCommissions]);

  return {
    ...realtime,
    commissionEvents: realtime.events.filter(e => e.type === 'commission')
  };
}

export function useGenealogyNotifications(userId?: string, options: Partial<UseRealtimeOptions> = {}) {
  const realtime = useRealtime({
    userId,
    ...options
  });

  useEffect(() => {
    if (realtime.isConnected) {
      realtime.subscribeToGenealogy();
    }
  }, [realtime.isConnected, realtime.subscribeToGenealogy]);

  return {
    ...realtime,
    genealogyEvents: realtime.events.filter(e => e.type === 'genealogy')
  };
}

export function useDashboardNotifications(userId?: string, options: Partial<UseRealtimeOptions> = {}) {
  const realtime = useRealtime({
    userId,
    ...options
  });

  useEffect(() => {
    if (realtime.isConnected) {
      realtime.subscribeToDashboard();
    }
  }, [realtime.isConnected, realtime.subscribeToDashboard]);

  return {
    ...realtime,
    dashboardEvents: realtime.events.filter(e => e.type === 'dashboard')
  };
}