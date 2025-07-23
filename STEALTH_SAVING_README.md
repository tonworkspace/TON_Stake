# Stealth Saving System for Divine Mining Staking

## Overview

The DailyRewards component now includes a comprehensive stealth saving system that automatically records user progress from localStorage to Supabase in the background. This system ensures data persistence, offline functionality, and seamless user experience without interrupting gameplay.

## Features

### 🔄 Automatic Background Saving
- **Auto-save Interval**: Every 30 seconds
- **Debounced Updates**: Prevents excessive API calls
- **Silent Operation**: No user interruption
- **Smart Batching**: Processes multiple operations efficiently

### 📱 Offline Support
- **Offline Queue**: Stores operations when connection is lost
- **Automatic Sync**: Processes queued operations when back online
- **Retry Logic**: Handles failed operations with exponential backoff
- **Data Integrity**: Ensures no data loss during connectivity issues

### 🛡️ Data Protection
- **User Isolation**: Each user's data is completely isolated
- **Conflict Resolution**: Handles concurrent updates gracefully
- **Error Recovery**: Automatic recovery from sync failures
- **Audit Trail**: Tracks all operations for debugging

## How It Works

### 1. **Real-time Monitoring**
```typescript
// Monitors online/offline status
useEffect(() => {
  const handleOnline = () => {
    setStealthSaveState(prev => ({ ...prev, isOnline: true }));
    // Process offline queue when connection restored
  };
  
  const handleOffline = () => {
    setStealthSaveState(prev => ({ ...prev, isOnline: false }));
    // Queue operations for later sync
  };
}, []);
```

### 2. **Automatic Data Synchronization**
```typescript
// Auto-save when user data changes
useEffect(() => {
  if (user?.id && stealthSaveState.autoSaveEnabled) {
    const timeoutId = setTimeout(() => {
      stealthSaveUserData();
    }, 2000); // 2-second debounce
    
    return () => clearTimeout(timeoutId);
  }
}, [userBalance, totalEarnings]);
```

### 3. **Offline Operation Queue**
```typescript
// Add operation to offline queue
const addToOfflineQueue = (operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) => {
  const newOperation: OfflineOperation = {
    ...operation,
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0
  };
  
  // Store in localStorage for offline persistence
  const currentQueue = getOfflineQueue();
  const updatedQueue = [...currentQueue, newOperation];
  saveOfflineQueue(updatedQueue);
};
```

## Configuration

### Stealth Save Settings
```typescript
const STEALTH_SAVE_CONFIG = {
  AUTO_SAVE_INTERVAL: 30000,        // 30 seconds
  OFFLINE_QUEUE_KEY: 'divine_mining_offline_queue',
  LAST_SYNC_KEY: 'divine_mining_last_sync',
  SYNC_RETRY_DELAY: 5000,           // 5 seconds
  MAX_RETRY_ATTEMPTS: 3,            // Max retry attempts
  BATCH_SIZE: 10,                   // Operations per batch
  MIN_SYNC_INTERVAL: 10000,         // Minimum sync interval
};
```

### Supported Operations
- `stake_create`: Creating new stakes
- `stake_update`: Updating existing stakes
- `reward_claim`: Claiming rewards
- `user_data_update`: Updating user balance/earnings
- `synergy_update`: Updating mining-staking synergy

## Database Integration

### Supabase Tables Used
1. **users**: User balance and earnings
2. **stakes**: Individual stake data
3. **user_game_data**: Mining synergy and game state
4. **user_activity_logs**: Operation tracking

### Database Functions
```sql
-- Process stake rewards
CREATE OR REPLACE FUNCTION claim_stake_rewards(
  p_stake_id INTEGER,
  p_user_id INTEGER
) RETURNS VOID AS $$
BEGIN
  -- Claim logic here
END;
$$ LANGUAGE plpgsql;
```

## User Interface

### Status Indicator
The system provides a real-time status indicator showing:
- **Online/Offline Status**: Green/red dot indicator
- **Sync Status**: Spinning loader during sync
- **Pending Operations**: Count of queued operations
- **Error Count**: Number of sync errors

### Visual Feedback
```
🔄 Auto-saving enabled     [🔄 Syncing...] [📝 3 pending]
📴 Offline mode - queuing changes     [⚠️ 1 errors]
```

## Error Handling

### Retry Logic
```typescript
if (operation.retryCount < STEALTH_SAVE_CONFIG.MAX_RETRY_ATTEMPTS) {
  failedOperations.push({
    ...operation,
    retryCount: operation.retryCount + 1
  });
} else {
  // Log permanent failure
  setStealthSaveState(prev => ({
    ...prev,
    syncErrors: [...prev.syncErrors, `Failed to sync ${operation.type}`]
  }));
}
```

### Error Recovery
- **Automatic Retry**: Failed operations are retried up to 3 times
- **Exponential Backoff**: Increasing delays between retries
- **Error Logging**: All errors are logged for debugging
- **User Notification**: Users are informed of sync issues

## Performance Optimization

### Debouncing
- **User Data**: 2-second debounce
- **Stakes**: 3-second debounce  
- **Synergy**: 5-second debounce

### Batching
- **Batch Size**: 10 operations per sync cycle
- **Parallel Processing**: Multiple operations processed simultaneously
- **Memory Management**: Automatic cleanup of processed operations

## Security Features

### User Data Isolation
```typescript
// User-specific storage keys
const getStakesStorageKey = (userId?: string) => 
  `divine_mining_stakes_${userId || 'anonymous'}`;

const getUserDataStorageKey = (userId?: string) => 
  `divine_mining_user_data_${userId || 'anonymous'}`;
```

### Data Validation
- **Type Checking**: All data is validated before processing
- **Sanitization**: Input data is sanitized to prevent injection
- **Access Control**: Users can only access their own data

## Monitoring and Debugging

### Console Logging
```typescript
console.log('🔄 User data stealth saved to Supabase');
console.log('📝 Added operation to offline queue:', operation.type);
console.log('✅ Successfully processed 5 offline operations');
console.log('⚠️ 2 operations failed and will be retried');
```

### Debug Functions
```typescript
// Debug synergy data
const debugSynergy = () => {
  console.log('Current synergy state:', miningSynergy);
  console.log('Pending operations:', stealthSaveState.pendingOperations);
  console.log('Sync errors:', stealthSaveState.syncErrors);
};
```

## Testing

### Manual Testing
1. **Online Mode**: Verify automatic saving every 30 seconds
2. **Offline Mode**: Disconnect internet and perform actions
3. **Reconnection**: Reconnect and verify queued operations sync
4. **Error Handling**: Simulate network errors and verify retry logic

### Automated Testing
```typescript
// Test stealth saving functionality
describe('Stealth Saving System', () => {
  it('should save user data automatically', async () => {
    // Test implementation
  });
  
  it('should queue operations when offline', async () => {
    // Test implementation
  });
  
  it('should sync queued operations when online', async () => {
    // Test implementation
  });
});
```

## Migration Guide

### From Local Storage Only
1. **Existing Data**: All existing localStorage data is preserved
2. **Automatic Migration**: Data is automatically synced to Supabase
3. **Backward Compatibility**: System works with or without internet

### Database Setup
```sql
-- Ensure required tables exist
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  balance DECIMAL(18, 6) DEFAULT 0,
  total_earned DECIMAL(18, 6) DEFAULT 0,
  -- ... other fields
);

CREATE TABLE IF NOT EXISTS stakes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL(18, 6) NOT NULL,
  -- ... other fields
);
```

## Troubleshooting

### Common Issues

#### Sync Not Working
1. Check internet connection
2. Verify Supabase credentials
3. Check browser console for errors
4. Ensure user is authenticated

#### Data Not Syncing
1. Check offline queue in localStorage
2. Verify operation types are supported
3. Check database permissions
4. Review error logs

#### Performance Issues
1. Reduce auto-save interval
2. Increase debounce delays
3. Reduce batch size
4. Check network latency

### Debug Commands
```javascript
// Check stealth save state
console.log('Stealth save state:', stealthSaveState);

// Check offline queue
console.log('Offline queue:', getOfflineQueue());

// Force manual sync
performStealthSave();

// Clear offline queue
saveOfflineQueue([]);
```

## Future Enhancements

### Planned Features
- **Real-time Sync**: WebSocket-based real-time synchronization
- **Conflict Resolution**: Advanced conflict detection and resolution
- **Data Compression**: Compress offline queue data
- **Analytics**: Sync performance metrics and analytics
- **Mobile Optimization**: Enhanced mobile offline support

### Performance Improvements
- **Service Worker**: Background sync using service workers
- **IndexedDB**: Use IndexedDB for larger offline storage
- **Compression**: Compress data before storage
- **Caching**: Intelligent caching strategies

## Conclusion

The stealth saving system provides a robust, user-friendly solution for data persistence in the Divine Mining Staking application. It ensures data integrity, provides offline functionality, and maintains a seamless user experience while automatically handling all the complexity of data synchronization in the background.

The system is designed to be:
- **Reliable**: No data loss, even during network issues
- **Efficient**: Minimal performance impact
- **User-friendly**: Transparent operation with clear status indicators
- **Scalable**: Handles multiple users and large datasets
- **Maintainable**: Well-documented and easy to debug 