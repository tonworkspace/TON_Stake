import { supabase } from './supabaseClient';
import { sha256 } from 'js-sha256';

// Security Configuration
export const SECURITY_CONFIG = {
  MAX_BALANCE_CHANGE: 10000, // Maximum allowed balance change per operation
  MAX_OPERATIONS_PER_MINUTE: 10,
  MAX_OFFLINE_QUEUE_SIZE: 50,
  DATA_INTEGRITY_ENABLED: true,
  RATE_LIMITING_ENABLED: true,
  OPERATION_SIGNING_ENABLED: true,
  SECURITY_LOGGING_ENABLED: true,
  RECONCILIATION_INTERVAL: 300000, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
  SUSPICIOUS_ACTIVITY_THRESHOLD: 5
};

// Rate Limiter
class RateLimiter {
  private operations = new Map<string, number[]>();

  canPerformOperation(userId: string, operationType: string): boolean {
    if (!SECURITY_CONFIG.RATE_LIMITING_ENABLED) return true;
    
    const key = `${userId}_${operationType}`;
    const now = Date.now();
    const userOps = this.operations.get(key) || [];
    
    // Remove operations older than 1 minute
    const recentOps = userOps.filter(time => now - time < 60000);
    
    if (recentOps.length >= SECURITY_CONFIG.MAX_OPERATIONS_PER_MINUTE) {
      return false;
    }
    
    recentOps.push(now);
    this.operations.set(key, recentOps);
    return true;
  }

  clearOldOperations() {
    const now = Date.now();
    for (const [key, operations] of this.operations.entries()) {
      const recentOps = operations.filter(time => now - time < 60000);
      if (recentOps.length === 0) {
        this.operations.delete(key);
      } else {
        this.operations.set(key, recentOps);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Data Integrity
export const generateDataHash = (data: any): string => {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  return sha256(dataString);
};

export const validateDataIntegrity = (data: any, expectedHash: string): boolean => {
  if (!SECURITY_CONFIG.DATA_INTEGRITY_ENABLED) return true;
  return generateDataHash(data) === expectedHash;
};

// Operation Signing
export const generateOperationSignature = (operation: any, userId: string): string => {
  if (!SECURITY_CONFIG.OPERATION_SIGNING_ENABLED) return 'disabled';
  
  const operationData = {
    type: operation.type,
    data: operation.data,
    userId: userId,
    timestamp: operation.timestamp
  };
  
  return sha256(JSON.stringify(operationData, Object.keys(operationData).sort()));
};

export const validateOperationSignature = (operation: any, userId: string, signature: string): boolean => {
  if (!SECURITY_CONFIG.OPERATION_SIGNING_ENABLED) return true;
  return generateOperationSignature(operation, userId) === signature;
};

// Security Logging
export const logSecurityEvent = async (event: {
  userId: number;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  ipAddress?: string;
  userAgent?: string;
}) => {
  if (!SECURITY_CONFIG.SECURITY_LOGGING_ENABLED) return;

  try {
    await supabase.from('security_events').insert({
      user_id: event.userId,
      event_type: event.eventType,
      severity: event.severity,
      details: event.details,
      ip_address: event.ipAddress || 'unknown',
      user_agent: event.userAgent || navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

// Data Validation
export const validateBalanceChange = (oldBalance: number, newBalance: number): boolean => {
  const change = Math.abs(newBalance - oldBalance);
  return change <= SECURITY_CONFIG.MAX_BALANCE_CHANGE;
};

export const validateStakeData = (stake: any): boolean => {
  return (
    stake.amount > 0 &&
    stake.amount <= 1000000 && // Max stake amount
    stake.daily_rate >= 0 &&
    stake.daily_rate <= 100 && // Max 100% daily rate
    typeof stake.is_active === 'boolean'
  );
};

// Server-Side Reconciliation
export const reconcileUserData = async (userId: number) => {
  try {
    // Get server-side data
    const { data: serverData, error: serverError } = await supabase
      .from('users')
      .select('balance, total_earned, last_active')
      .eq('id', userId)
      .single();

    if (serverError) throw serverError;

    // Get client-side data from localStorage
    const clientData = JSON.parse(localStorage.getItem(`divine_mining_user_data_${userId}`) || '{}');

    // Compare data
    const balanceDiff = Math.abs(serverData.balance - (clientData.balance || 0));
    const earningsDiff = Math.abs(serverData.total_earned - (clientData.totalEarnings || 0));

    // Check for suspicious discrepancies
    if (balanceDiff > SECURITY_CONFIG.MAX_BALANCE_CHANGE || earningsDiff > SECURITY_CONFIG.MAX_BALANCE_CHANGE) {
      await logSecurityEvent({
        userId,
        eventType: 'data_discrepancy',
        severity: 'high',
        details: {
          server_balance: serverData.balance,
          client_balance: clientData.balance,
          server_earnings: serverData.total_earned,
          client_earnings: clientData.totalEarnings,
          balance_difference: balanceDiff,
          earnings_difference: earningsDiff
        }
      });

      // Use server data as source of truth
      return serverData;
    }

    return clientData;
  } catch (error) {
    console.error('Reconciliation failed:', error);
    return null;
  }
};

// Suspicious Activity Detection
export const detectSuspiciousActivity = async (userId: number, operation: any): Promise<boolean> => {
  try {
    // Check recent security events
    const { data: recentEvents } = await supabase
      .from('security_events')
      .select('event_type, severity, timestamp')
      .eq('user_id', userId)
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('timestamp', { ascending: false });

    const highSeverityEvents = recentEvents?.filter(event => 
      event.severity === 'high' || event.severity === 'critical'
    ).length || 0;

    if (highSeverityEvents >= SECURITY_CONFIG.SUSPICIOUS_ACTIVITY_THRESHOLD) {
      await logSecurityEvent({
        userId,
        eventType: 'suspicious_activity_threshold_exceeded',
        severity: 'critical',
        details: {
          recent_high_severity_events: highSeverityEvents,
          operation: operation
        }
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Suspicious activity detection failed:', error);
    return false;
  }
};

// Clean up old rate limiter data
setInterval(() => {
  rateLimiter.clearOldOperations();
}, 60000); // Every minute 