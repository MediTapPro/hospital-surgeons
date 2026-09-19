import { AdminDashboardRepository } from '@/lib/repositories/admin-dashboard.repository';

export class AdminDashboardService {
  private repository = new AdminDashboardRepository();

  async getDashboardStats() {
    try {
      const stats = await this.repository.getStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        success: false,
        message: 'Failed to fetch dashboard statistics',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getRecentActivity(limit: number = 10) {
    try {
      const raw = await this.repository.getRecentActivity(limit);
      const activities: any[] = [];

      // Format verification activities
      raw.verifications.forEach((row: any) => {
        const doctorName = row.doctor_name || 'Unknown Doctor';
        const hospitalName = row.hospital_name || 'Unknown Hospital';

        activities.push({
          id: `verification-${row.id}`,
          type: 'verification',
          message: row.action === 'verify'
            ? `${row.entity_type === 'doctor' ? 'Dr. ' + doctorName : hospitalName} verified`
            : row.action === 'reject'
            ? `${row.entity_type === 'doctor' ? 'Dr. ' + doctorName : hospitalName} verification rejected`
            : `${row.entity_type === 'doctor' ? 'Dr. ' + doctorName : hospitalName} verification requested`,
          time: formatTimeAgo(new Date(row.created_at)),
          createdAt: row.created_at,
          status: row.action === 'verify' ? 'verified' : row.action === 'reject' ? 'rejected' : 'pending',
          entityType: row.entity_type,
          entityId: row.entity_id,
        });
      });

      // Format assignment activities
      raw.assignments.forEach((assignment) => {
        const doctorName = [assignment.doctorFirstName, assignment.doctorLastName]
          .filter(Boolean)
          .join(' ') || 'an assigned doctor';
        const assignmentLabel = assignment.source === 'patient'
          ? 'Home visit'
          : `Assignment at ${assignment.hospitalName || 'hospital'}`;

        activities.push({
          id: `assignment-${assignment.id}`,
          type: 'assignment',
          message: assignment.status === 'completed'
            ? `${assignmentLabel} completed by Dr. ${doctorName}`
            : assignment.status === 'pending'
            ? `New ${assignmentLabel.toLowerCase()} created for Dr. ${doctorName}`
            : `${assignmentLabel} ${assignment.status}`,
          time: formatTimeAgo(new Date(assignment.requestedAt as string)),
          createdAt: assignment.requestedAt,
          status: assignment.status === 'completed' ? 'completed' : assignment.priority === 'high' ? 'urgent' : assignment.status,
          priority: assignment.priority,
        });
      });

      // Format registration activities
      raw.registrations.forEach((row: any) => {
        activities.push({
          id: `registration-${row.id}`,
          type: 'registration',
          message: `New ${row.role} registration: ${row.role === 'doctor' ? 'Dr. ' + row.doctor_name : row.hospital_name}`,
          time: formatTimeAgo(new Date(row.created_at)),
          createdAt: row.created_at,
          status: 'pending',
          role: row.role,
        });
      });

      // Format subscription activities
      raw.subscriptions.forEach((sub: any) => {
        activities.push({
          id: `subscription-${sub.id}`,
          type: 'subscription',
          message: `${sub.status === 'active' ? 'Premium plan activated' : 'Subscription ' + sub.status} for ${sub.user_name}`,
          time: formatTimeAgo(new Date(sub.created_at || sub.start_date)),
          createdAt: sub.created_at || sub.start_date,
          status: sub.status === 'active' ? 'active' : 'pending',
        });
      });

      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        success: true,
        data: activities.slice(0, limit),
      };
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return {
        success: false,
        message: 'Failed to fetch recent activity',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDashboardAlerts() {
    try {
      const counts = await this.repository.getAlerts();
      const alerts: any[] = [];

      const totalPendingVerifications = counts.pendingDoctorVerifications + counts.pendingHospitalVerifications;
      if (totalPendingVerifications > 0) {
        alerts.push({
          id: 'pending-verifications',
          message: `${totalPendingVerifications} verification${totalPendingVerifications !== 1 ? 's' : ''} pending review`,
          priority: totalPendingVerifications > 5 ? 'high' : 'medium',
          time: 'Today',
          type: 'verification',
          count: totalPendingVerifications,
        });
      }

      if (counts.expiringSubscriptions > 0) {
        alerts.push({
          id: 'expiring-subscriptions',
          message: `${counts.expiringSubscriptions} subscription plan${counts.expiringSubscriptions !== 1 ? 's' : ''} expiring in the next 7 days`,
          priority: counts.expiringSubscriptions > 10 ? 'high' : 'medium',
          time: 'This Week',
          type: 'subscription',
          count: counts.expiringSubscriptions,
        });
      }

      if (counts.expiringTomorrow > 0) {
        alerts.push({
          id: 'expiring-tomorrow',
          message: `${counts.expiringTomorrow} subscription plan${counts.expiringTomorrow !== 1 ? 's' : ''} expiring tomorrow`,
          priority: 'high',
          time: 'Tomorrow',
          type: 'subscription',
          count: counts.expiringTomorrow,
        });
      }

      if (counts.highPriorityAssignments > 0) {
        alerts.push({
          id: 'high-priority-assignments',
          message: `${counts.highPriorityAssignments} high priority assignment${counts.highPriorityAssignments !== 1 ? 's' : ''} pending`,
          priority: 'high',
          time: 'Today',
          type: 'assignment',
          count: counts.highPriorityAssignments,
        });
      }

      if (counts.urgentTickets > 0) {
        alerts.push({
          id: 'urgent-tickets',
          message: `${counts.urgentTickets} urgent support ticket${counts.urgentTickets !== 1 ? 's' : ''} require attention`,
          priority: 'high',
          time: 'Today',
          type: 'support',
          count: counts.urgentTickets,
        });
      }

      if (counts.overdueAssignments > 0) {
        alerts.push({
          id: 'overdue-assignments',
          message: `${counts.overdueAssignments} assignment${counts.overdueAssignments !== 1 ? 's' : ''} overdue`,
          priority: 'high',
          time: 'Today',
          type: 'assignment',
          count: counts.overdueAssignments,
        });
      }

      // System maintenance placeholder
      alerts.push({
        id: 'system-maintenance',
        message: 'System maintenance scheduled',
        priority: 'low',
        time: 'Tomorrow',
        type: 'system',
      });

      // Sort by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      alerts.sort((a, b) => (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0));

      return {
        success: true,
        data: alerts,
      };
    } catch (error) {
      console.error('Error fetching dashboard alerts:', error);
      return {
        success: false,
        message: 'Failed to fetch dashboard alerts',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDashboardTrends(months: number = 6) {
    try {
      const data = await this.repository.getTrends(months);
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error fetching dashboard trends:', error);
      return {
        success: false,
        message: 'Failed to fetch dashboard trends',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} sec${diffInSeconds !== 1 ? 's' : ''} ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
}
