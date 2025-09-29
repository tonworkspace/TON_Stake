import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import useAuth from '@/hooks/useAuth';

interface StatusNotification {
  id: number;
  order_id: number;
  claim_amount: number;
  status: string;
  message: string;
  timestamp: string;
}

const OrderStatusNotifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<StatusNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check for status changes every 30 seconds
    const interval = setInterval(checkStatusUpdates, 30000);
    checkStatusUpdates(); // Initial check

    return () => clearInterval(interval);
  }, [user]);

  const checkStatusUpdates = async () => {
    if (!user) return;

    try {
      // Get recent orders with status changes
      const { data, error } = await supabase
        .from('user_order_status')
        .select('id, claim_amount, approval_status, payment_status, claimed_at')
        .eq('user_id', user.id)
        .gte('claimed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('claimed_at', { ascending: false });

      if (error) throw error;

      // Generate notifications based on status
      const newNotifications: StatusNotification[] = [];
      
      data?.forEach((order) => {
        const status = `${order.approval_status}_${order.payment_status}`;
        
        switch (status) {
          case 'approved_pending':
            newNotifications.push({
              id: order.id,
              order_id: order.id,
              claim_amount: order.claim_amount,
              status: 'approved',
              message: `Order #${order.id} has been approved! Payment processing will begin soon.`,
              timestamp: order.claimed_at
            });
            break;
          case 'approved_processing':
            newNotifications.push({
              id: order.id + 1000,
              order_id: order.id,
              claim_amount: order.claim_amount,
              status: 'processing',
              message: `Payment for Order #${order.id} is now being processed.`,
              timestamp: order.claimed_at
            });
            break;
          case 'approved_completed':
            newNotifications.push({
              id: order.id + 2000,
              order_id: order.id,
              claim_amount: order.claim_amount,
              status: 'completed',
              message: `🎉 Payment completed for Order #${order.id}! You have received ${order.claim_amount.toLocaleString()} STK tokens.`,
              timestamp: order.claimed_at
            });
            break;
          case 'rejected_pending':
            newNotifications.push({
              id: order.id + 3000,
              order_id: order.id,
              claim_amount: order.claim_amount,
              status: 'rejected',
              message: `Order #${order.id} has been rejected. Please check your order details.`,
              timestamp: order.claimed_at
            });
            break;
        }
      });

      setNotifications(newNotifications);
    } catch (error) {
      console.error('Error checking status updates:', error);
    }
  };

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return '✅';
      case 'processing': return '🔄';
      case 'completed': return '🎉';
      case 'rejected': return '❌';
      default: return '📢';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'border-green-500/50 bg-green-900/20';
      case 'processing': return 'border-purple-500/50 bg-purple-900/20';
      case 'completed': return 'border-green-500/50 bg-green-900/20';
      case 'rejected': return 'border-red-500/50 bg-red-900/20';
      default: return 'border-blue-500/50 bg-blue-900/20';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors"
      >
        📢
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {notifications.length}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border ${getStatusColor(notification.status)} backdrop-blur-sm`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getStatusIcon(notification.status)}</span>
                    <span className="text-white font-semibold text-sm">
                      Order #{notification.order_id}
                    </span>
                  </div>
                  <p className="text-gray-200 text-sm">
                    {notification.message}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {new Date(notification.timestamp).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="ml-2 text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderStatusNotifications;
