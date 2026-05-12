/**
 * REAL-TIME NOTIFICATION SERVICE
 *
 * Provides WebSocket-based real-time updates for:
 * - Commission notifications
 * - Genealogy tree changes
 * - System announcements
 * - Live dashboard updates
 *
 * Created: 2025-11-20 (Enhancement)
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';

export interface RealtimeEvent {
  type: 'commission' | 'genealogy' | 'notification' | 'system' | 'dashboard';
  userId: string;
  companyId?: string;
  data: any;
  timestamp: Date;
}

export interface SocketUser {
  id: string;
  userId: string;
  companyId?: string;
  socketId: string;
  connectedAt: Date;
}

class RealtimeService {
  private io: SocketIOServer | null = null;
  private connectedUsers = new Map<string, SocketUser>();
  private userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    logger.info('Real-time service initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // Authentication middleware
      socket.use(async (packet, next) => {
        try {
          const token = socket.handshake.auth.token;
          if (!token) {
            return next(new Error('Authentication required'));
          }

          // Verify JWT token (simplified - should use proper JWT verification)
          const userId = socket.handshake.auth.userId;
          const companyId = socket.handshake.auth.companyId;

          if (!userId) {
            return next(new Error('User ID required'));
          }

          // Register user connection
          this.registerUser(socket.id, userId, companyId);
          next();
        } catch (error) {
          logger.error('Socket authentication failed:', { error });
          next(new Error('Authentication failed'));
        }
      });

      // Handle user joining rooms
      socket.on('join', (data: { userId: string; companyId?: string }) => {
        socket.join(`user:${data.userId}`);
        if (data.companyId) {
          socket.join(`company:${data.companyId}`);
        }
        socket.join('global'); // For system announcements

        logger.info(`User ${data.userId} joined rooms`);
      });

      // Handle commission updates subscription
      socket.on('subscribe-commissions', (userId: string) => {
        socket.join(`commissions:${userId}`);
      });

      // Handle genealogy updates subscription
      socket.on('subscribe-genealogy', (userId: string) => {
        socket.join(`genealogy:${userId}`);
      });

      // Handle dashboard updates subscription
      socket.on('subscribe-dashboard', (userId: string) => {
        socket.join(`dashboard:${userId}`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.unregisterUser(socket.id);
        logger.info(`Socket disconnected: ${socket.id}`);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });
    });
  }

  /**
   * Register user connection
   */
  private registerUser(socketId: string, userId: string, companyId?: string): void {
    const user: SocketUser = {
      id: socketId,
      userId,
      companyId,
      socketId,
      connectedAt: new Date()
    };

    this.connectedUsers.set(socketId, user);

    // Add to user sockets map
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  /**
   * Unregister user connection
   */
  private unregisterUser(socketId: string): void {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      this.connectedUsers.delete(socketId);

      // Remove from user sockets map
      const userSockets = this.userSockets.get(user.userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          this.userSockets.delete(user.userId);
        }
      }
    }
  }

  /**
   * Send real-time event to specific user
   */
  async sendToUser(userId: string, event: RealtimeEvent): Promise<void> {
    if (!this.io) return;

    try {
      // Send to user's personal room
      this.io.to(`user:${userId}`).emit('notification', event);

      // Send to specific event rooms if subscribed
      switch (event.type) {
        case 'commission':
          this.io.to(`commissions:${userId}`).emit('commission-update', event);
          break;
        case 'genealogy':
          this.io.to(`genealogy:${userId}`).emit('genealogy-update', event);
          break;
        case 'dashboard':
          this.io.to(`dashboard:${userId}`).emit('dashboard-update', event);
          break;
      }

      // Log the event
      await this.logRealtimeEvent(event);
      logger.info(`Real-time event sent to user ${userId}: ${event.type}`);

    } catch (error) {
      logger.error('Failed to send real-time event:', { error });
    }
  }

  /**
   * Send event to all users in a company
   */
  async sendToCompany(companyId: string, event: RealtimeEvent): Promise<void> {
    if (!this.io) return;

    try {
      this.io.to(`company:${companyId}`).emit('company-notification', event);
      logger.info(`Real-time event sent to company ${companyId}: ${event.type}`);
    } catch (error) {
      logger.error('Failed to send company event:', { error });
    }
  }

  /**
   * Send system-wide announcement
   */
  async sendSystemAnnouncement(event: Omit<RealtimeEvent, 'userId'>): Promise<void> {
    if (!this.io) return;

    try {
      this.io.to('global').emit('system-announcement', event);
      logger.info(`System announcement sent: ${event.type}`);
    } catch (error) {
      logger.error('Failed to send system announcement:', { error });
    }
  }

  /**
   * Notify user of new commission
   */
  async notifyCommission(userId: string, commissionData: any, companyId?: string): Promise<void> {
    await this.sendToUser(userId, {
      type: 'commission',
      userId,
      companyId,
      data: commissionData,
      timestamp: new Date()
    });
  }

  /**
   * Notify user of genealogy changes
   */
  async notifyGenealogyChange(userId: string, changeData: any, companyId?: string): Promise<void> {
    await this.sendToUser(userId, {
      type: 'genealogy',
      userId,
      companyId,
      data: changeData,
      timestamp: new Date()
    });
  }

  /**
   * Notify user of dashboard updates
   */
  async notifyDashboardUpdate(userId: string, dashboardData: any, companyId?: string): Promise<void> {
    await this.sendToUser(userId, {
      type: 'dashboard',
      userId,
      companyId,
      data: dashboardData,
      timestamp: new Date()
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    connectedSockets: number;
    connectedUsers: number;
    activeCompanies: number;
  } {
    const uniqueUsers = new Set(Array.from(this.connectedUsers.values()).map(u => u.userId));
    const uniqueCompanies = new Set(Array.from(this.connectedUsers.values()).map(u => u.companyId).filter(Boolean));

    return {
      connectedSockets: this.connectedUsers.size,
      connectedUsers: uniqueUsers.size,
      activeCompanies: uniqueCompanies.size
    };
  }

  /**
   * Log real-time event to database
   */
  private async logRealtimeEvent(event: RealtimeEvent): Promise<void> {
    try {
      // Create a simple log entry (could be expanded to a dedicated table)
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          action: `realtime_${event.type}`,
          entity: 'notification',
          entityId: null,
          changes: event.data,
          ipAddress: null,
          userAgent: null,
          companyId: event.companyId
        }
      });
    } catch (error) {
      logger.error('Failed to log real-time event:', { error });
    }
  }

  /**
   * Broadcast leaderboard updates
   */
  async broadcastLeaderboardUpdate(companyId: string, leaderboardData: any): Promise<void> {
    if (!this.io) return;

    try {
      this.io.to(`company:${companyId}`).emit('leaderboard-update', {
        companyId,
        data: leaderboardData,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to broadcast leaderboard update:', { error });
    }
  }

  /**
   * Send urgent notification (high priority)
   */
  async sendUrgentNotification(userId: string, message: string, companyId?: string): Promise<void> {
    await this.sendToUser(userId, {
      type: 'notification',
      userId,
      companyId,
      data: {
        message,
        priority: 'urgent',
        requiresAction: true
      },
      timestamp: new Date()
    });
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();

// Helper hook for React components (client-side)
export const useRealtime = () => {
  // This would be implemented in a React hook file
  // For now, just export the service for server-side use
  return realtimeService;
};