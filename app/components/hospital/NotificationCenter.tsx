'use client';

import { CheckCircle, XCircle, Clock, Bell, CreditCard, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';

interface NotificationCenterProps {
  onClose: () => void;
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const notifications = [
    {
      id: 1,
      type: 'assignment-accepted',
      title: 'Assignment Accepted',
      message: 'Dr. Sarah Johnson accepted the assignment for John Smith',
      time: '10 minutes ago',
      read: false,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      id: 2,
      type: 'assignment-declined',
      title: 'Assignment Declined',
      message: 'Dr. Robert Smith declined the assignment for Michael Chen',
      time: '1 hour ago',
      read: false,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      id: 3,
      type: 'assignment-expiring',
      title: 'Assignment Expiring Soon',
      message: 'Assignment for Emma Wilson expires in 6 hours',
      time: '2 hours ago',
      read: false,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      id: 4,
      type: 'subscription',
      title: 'Subscription Renewal',
      message: 'Your Gold plan will renew on December 1, 2024',
      time: '1 day ago',
      read: true,
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 5,
      type: 'document',
      title: 'Document Verified',
      message: 'Your Hospital Registration License has been verified',
      time: '2 days ago',
      read: true,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-900">Notifications</h3>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {notifications.filter(n => !n.read).length} new
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-7">
            Mark all as read
          </Button>
        </div>
      </div>

      <ScrollArea className="h-96">
        <div className="p-2">
          {notifications.map((notification) => {
            const Icon = notification.icon;
            return (
              <div
                key={notification.id}
                className={`p-3 rounded-lg mb-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                  !notification.read ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex gap-3">
                  <div className={`${notification.bgColor} ${notification.color} p-2 rounded-lg h-fit`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm text-gray-900">{notification.title}</p>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full ml-2 flex-shrink-0 mt-1"></div>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{notification.message}</p>
                    <p className="text-xs text-gray-400">{notification.time}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-gray-200">
        <Button variant="ghost" size="sm" className="w-full text-sm">
          View All Notifications
        </Button>
      </div>
    </div>
  );
}
