import { NotificationsRepository, CreateNotificationData, NotificationQuery } from '@/lib/repositories/notifications.repository';
import { PushNotificationService, PushNotificationPayload } from './push-notification.service';

export class NotificationsService {
  private repo = new NotificationsRepository();
  private pushNotificationService = new PushNotificationService();

  async create(dto: CreateNotificationData) {
    try {
      const notification = await this.repo.create(dto);
      return {
        success: true,
        message: 'Notification created successfully',
        data: notification,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create notification',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async list(query: NotificationQuery) {
    try {
      const result = await this.repo.list(query);
      return {
        success: true,
        message: 'Notifications retrieved successfully',
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve notifications',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async get(id: string) {
    try {
      const data = await this.repo.get(id);
      if (!data) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }
      return {
        success: true,
        message: 'Notification retrieved successfully',
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve notification',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async markRead(id: string) {
    try {
      const notification = await this.repo.markRead(id, true);
      return {
        success: true,
        message: 'Notification marked as read',
        data: notification,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark notification as read',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async markUnread(id: string) {
    try {
      const notification = await this.repo.markRead(id, false);
      return {
        success: true,
        message: 'Notification marked as unread',
        data: notification,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark notification as unread',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getPreferences(userId: string) {
    try {
      const prefs = await this.repo.getPreferences(userId);
      return {
        success: true,
        message: 'Notification preferences retrieved successfully',
        data: prefs,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve notification preferences',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async upsertPreferences(userId: string, prefs: {
    bookingUpdatesPush?: boolean;
    bookingUpdatesEmail?: boolean;
    paymentPush?: boolean;
    remindersPush?: boolean;
  }) {
    try {
      const result = await this.repo.upsertPreferences(userId, prefs);
      return {
        success: true,
        message: 'Notification preferences updated successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update notification preferences',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send push notification to a user
   * Creates DB record and sends push notification
   */
  async sendPushNotification(
    userId: string,
    notificationData: CreateNotificationData
  ): Promise<{ success: boolean; notification?: any; pushResult?: any }> {
    try {
      // Check user preferences if it's a booking/assignment notification
      if (notificationData.notificationType === 'booking') {
        const prefs = await this.repo.getPreferences(userId);
        if (prefs && prefs.bookingUpdatesPush === false) {
          console.log(`📱 Push notification skipped for user ${userId} (preferences disabled)`);
          // Still create DB record, just don't send push
          const notification = await this.repo.create(notificationData);
          return {
            success: true,
            notification,
            pushResult: { success: false, sentCount: 0, skipped: true },
          };
        }
      }

      // Create DB notification record
      const notification = await this.repo.create(notificationData);

      // Prepare push notification payload
      // FCM requires all data values to be strings
      const stringifyDataValue = (value: any): string => {
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      };

      // Simplified payload format: only deepLink, pn_id, and type
      // Deep link is always just the base path (assignment ID is in pn_id)
      const deepLink = 'hospitalapp://view_assignment';

      // Determine notification type
      const notificationType = notificationData.notificationType || 
                               notificationData.payload?.notificationType || 
                               'system';

      // Simplified payload with only essential fields
      const payloadData: Record<string, string> = {
        deepLink: deepLink,
        pn_id: String(notification.id), // Push notification ID
        type: String(notificationType), // Notification type
      };

      const pushPayload: PushNotificationPayload = {
        title: notificationData.title,
        body: notificationData.message,
        data: payloadData,
        sound: 'default',
        badge: 1,
      };

      // Send push notification (don't fail if push fails)
      let pushResult;
      try {
        console.log(`📬 [NOTIFICATIONS SERVICE] Attempting to send push notification to user ${userId}`);
        console.log(`📬 [NOTIFICATIONS SERVICE] Notification ID: ${notification.id}`);
        console.log(`📬 [NOTIFICATIONS SERVICE] Notification Type: ${notificationData.notificationType}`);
        
        pushResult = await this.pushNotificationService.sendPushNotification(userId, pushPayload);
        
        if (pushResult.success && pushResult.sentCount > 0) {
          console.log(`✅ [NOTIFICATIONS SERVICE] SUCCESS: Push notification sent to user ${userId}`);
          console.log(`✅ [NOTIFICATIONS SERVICE] Sent to ${pushResult.sentCount} device(s)`);
          console.log(`✅ [NOTIFICATIONS SERVICE] Notification ID: ${notification.id}`);
        } else if (pushResult.error) {
          // There was an error (e.g., Firebase not initialized)
          console.warn(`⚠️  [NOTIFICATIONS SERVICE] Push notification failed for user ${userId}`);
          console.warn(`⚠️  [NOTIFICATIONS SERVICE] Error: ${pushResult.error}`);
          console.warn(`⚠️  [NOTIFICATIONS SERVICE] Notification ID: ${notification.id} (DB record created)`);
        } else if (pushResult.sentCount === 0) {
          // No error, but no devices (legitimate case - user has no active devices)
          console.log(`ℹ️  [NOTIFICATIONS SERVICE] No devices: Push notification skipped for user ${userId} (no active devices)`);
          console.log(`ℹ️  [NOTIFICATIONS SERVICE] Notification ID: ${notification.id} (DB record created)`);
        } else {
          console.warn(`⚠️  [NOTIFICATIONS SERVICE] PARTIAL FAILURE: Push notification failed for user ${userId}`);
          console.warn(`⚠️  [NOTIFICATIONS SERVICE] Error: ${pushResult.error || 'Unknown error'}`);
          console.warn(`⚠️  [NOTIFICATIONS SERVICE] Notification ID: ${notification.id} (DB record created)`);
        }
      } catch (pushError) {
        console.error(`❌ [NOTIFICATIONS SERVICE] FAILURE: Exception while sending push notification to user ${userId}`);
        console.error(`❌ [NOTIFICATIONS SERVICE] Notification ID: ${notification.id}`);
        console.error(`❌ [NOTIFICATIONS SERVICE] Error:`, pushError instanceof Error ? pushError.message : String(pushError));
        console.error(`❌ [NOTIFICATIONS SERVICE] Stack:`, pushError instanceof Error ? pushError.stack : 'No stack trace');
        pushResult = { success: false, sentCount: 0, error: pushError instanceof Error ? pushError.message : String(pushError) };
      }

      return {
        success: true,
        notification,
        pushResult,
      };
    } catch (error) {
      console.error('Error in sendPushNotification:', error);
      return {
        success: false,
        notification: undefined,
        pushResult: undefined,
      };
    }
  }
}



































