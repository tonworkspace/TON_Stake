import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface SecurityEvent {
  id: number;
  user_id: number;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  timestamp: string;
}

const SecurityDashboard: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    criticalEvents: 0,
    highSeverityEvents: 0,
    suspiciousUsers: 0
  });

  useEffect(() => {
    loadSecurityEvents();
    loadSecurityStats();
  }, []);

  const loadSecurityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Failed to load security events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityStats = async () => {
    try {
      // Get total events
      const { count: totalEvents } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true });

      // Get critical events
      const { count: criticalEvents } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical');

      // Get high severity events
      const { count: highSeverityEvents } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .in('severity', ['high', 'critical']);

      // Get suspicious users (users with multiple high severity events)
      const { data: suspiciousUsers } = await supabase
        .from('security_events')
        .select('user_id')
        .in('severity', ['high', 'critical'])
        .gte('timestamp', new Date(Date.now() - 86400000).toISOString()); // Last 24 hours

      const uniqueSuspiciousUsers = new Set(suspiciousUsers?.map(e => e.user_id)).size;

      setStats({
        totalEvents: totalEvents || 0,
        criticalEvents: criticalEvents || 0,
        highSeverityEvents: highSeverityEvents || 0,
        suspiciousUsers: uniqueSuspiciousUsers
      });
    } catch (error) {
      console.error('Failed to load security stats:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return <div className="p-4">Loading security dashboard...</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Security Dashboard</h2>
      
      {/* Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Events</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Critical Events</h3>
          <p className="text-2xl font-bold text-red-600">{stats.criticalEvents}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">High Severity</h3>
          <p className="text-2xl font-bold text-orange-600">{stats.highSeverityEvents}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Suspicious Users</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.suspiciousUsers}</p>
        </div>
      </div>

      {/* Recent Security Events */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Security Events</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {events.map((event) => (
            <div key={event.id} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(event.severity)}`}>
                    {event.severity.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {event.event_type}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-sm text-gray-500">User ID: {event.user_id}</span>
                {event.details && (
                  <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard; 