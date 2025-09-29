import React from 'react';
import useAuth from '@/hooks/useAuth';

interface AdminAccessControlProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AdminAccessControl: React.FC<AdminAccessControlProps> = ({ 
  children, 
  fallback = (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center p-6 bg-red-900/20 border border-red-500/30 rounded-lg max-w-sm">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="text-red-400 font-bold mb-2">Access Restricted</h3>
        <p className="text-gray-300 text-sm">
          Admin access is limited to authorized users only.
        </p>
      </div>
    </div>
  )
}) => {
  const { user } = useAuth();

  // Check if user has admin access
  // You can modify this logic based on your admin requirements
  const isAdmin = user && (
    // Option 1: Check if user has admin role in database
    user.role === 'admin' ||
    // Option 2: Check specific user IDs (replace with actual admin user IDs)
    user.id === 1 ||
    user.id === 2 ||
    // Option 3: Check if user has admin permissions
    user.permissions?.includes('admin') ||
    // Option 4: Check Telegram username (for testing)
    user.username?.toLowerCase().includes('admin') ||
    user.username?.toLowerCase().includes('owner') ||
    user.username?.toLowerCase().includes('dev')
  );

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default AdminAccessControl;


