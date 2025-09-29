# Backend Withdrawal Approval System Guide

## Overview

This guide explains how to approve withdrawals on the backend for the TON Stake application. The system provides multiple methods for managing withdrawal requests, from direct database operations to API endpoints and admin dashboard interfaces.

## System Architecture

### Database Schema
- **`withdrawals` table**: Main withdrawal requests storage
- **`withdrawal_logs` table**: Detailed audit trail and processing logs
- **`withdrawal_management_view`**: Admin-friendly view with user details
- **`users` table**: User information and balance management

### Withdrawal Status Flow
```
pending → processing → completed
    ↓
  failed/cancelled (auto-refund)
```

## Method 1: Direct Database Operations (Quick & Simple)

### View Pending Withdrawals
```sql
-- Get all pending withdrawal requests
SELECT * FROM withdrawal_management_view WHERE status = 'pending';

-- Get specific user's withdrawals
SELECT * FROM withdrawal_management_view WHERE telegram_id = '123456789';
```

### Approve a Withdrawal
```sql
-- Move withdrawal to processing status
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,  -- Replace with actual withdrawal ID
    p_status := 'processing',
    p_processing_notes := 'Withdrawal approved and processing',
    p_processed_by := NULL  -- Optional: admin user ID
);
```

### Complete a Withdrawal
```sql
-- Mark withdrawal as completed after sending TON
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,
    p_status := 'completed',
    p_transaction_hash := 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG',
    p_processing_notes := 'TON sent successfully to wallet'
);
```

### Reject a Withdrawal
```sql
-- Reject withdrawal (automatically refunds user)
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,
    p_status := 'failed',
    p_processing_notes := 'Invalid wallet address or insufficient funds'
);
```

## Method 2: Backend API Endpoints

### Available Endpoints

#### Get Pending Withdrawals
```bash
GET /api/withdrawals/pending
```

#### Get Withdrawals by Status
```bash
GET /api/withdrawals/status/{status}
# status: pending, processing, completed, failed
```

#### Approve Withdrawal
```bash
POST /api/withdrawals/{id}/approve
Content-Type: application/json

{
  "adminUserId": 1,
  "notes": "Withdrawal approved for processing"
}
```

#### Complete Withdrawal
```bash
POST /api/withdrawals/{id}/complete
Content-Type: application/json

{
  "transactionHash": "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG",
  "adminUserId": 1,
  "notes": "TON transaction completed successfully"
}
```

#### Reject Withdrawal
```bash
POST /api/withdrawals/{id}/reject
Content-Type: application/json

{
  "reason": "Invalid wallet address format",
  "adminUserId": 1
}
```

#### Batch Approve Multiple Withdrawals
```bash
POST /api/withdrawals/batch-approve
Content-Type: application/json

{
  "withdrawalIds": [123, 124, 125],
  "adminUserId": 1,
  "notes": "Batch approval for pending withdrawals"
}
```

#### Get Withdrawal Statistics
```bash
GET /api/withdrawals/stats
```

## Method 3: Admin Dashboard Interface

### Using the WithdrawalAdminDashboard Component

The `WithdrawalAdminDashboard` component provides a complete web interface for managing withdrawals:

```tsx
import { WithdrawalAdminDashboard } from './components/WithdrawalAdminDashboard';

// In your admin page
<WithdrawalAdminDashboard adminUserId={currentAdminId} />
```

### Features:
- **Statistics Overview**: View pending, processing, completed, and failed withdrawal counts
- **Status Filtering**: Filter withdrawals by status
- **Individual Actions**: Approve, complete, or reject individual withdrawals
- **Batch Operations**: Select and approve multiple withdrawals at once
- **Real-time Updates**: Automatic refresh after actions
- **Transaction Hash Input**: Easy input for TON transaction hashes

## Method 4: Programmatic Backend Functions

### Using the withdrawalManagement Library

```typescript
import {
  getPendingWithdrawals,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  getWithdrawalStats
} from './lib/withdrawalManagement';

// Get all pending withdrawals
const pendingWithdrawals = await getPendingWithdrawals();

// Approve a withdrawal
const success = await approveWithdrawal(123, adminUserId, 'Approved for processing');

// Complete a withdrawal
const completed = await completeWithdrawal(
  123, 
  'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG',
  adminUserId,
  'TON sent successfully'
);

// Reject a withdrawal
const rejected = await rejectWithdrawal(123, 'Invalid wallet address', adminUserId);
```

## Complete Approval Workflow

### Step 1: Review Pending Withdrawals
```sql
SELECT 
    id,
    telegram_id,
    username,
    amount,
    wallet_amount,
    wallet_address,
    created_at
FROM withdrawal_management_view 
WHERE status = 'pending'
ORDER BY created_at ASC;
```

### Step 2: Validate Withdrawal
- Check user's available balance
- Verify TON wallet address format
- Confirm withdrawal amount is within limits
- Review user's withdrawal history

### Step 3: Approve for Processing
```sql
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,
    p_status := 'processing',
    p_processing_notes := 'Validated and approved for processing'
);
```

### Step 4: Send TON Transaction
- Use your TON wallet to send the `wallet_amount` to the `wallet_address`
- Record the transaction hash from the blockchain

### Step 5: Mark as Completed
```sql
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,
    p_status := 'completed',
    p_transaction_hash := 'your_ton_transaction_hash_here',
    p_processing_notes := 'TON sent successfully'
);
```

## Error Handling and Rejection

### Common Rejection Reasons
- Invalid TON wallet address format
- Insufficient user balance
- Suspicious activity patterns
- Duplicate withdrawal attempts
- User account issues

### Rejection Process
```sql
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,
    p_status := 'failed',
    p_processing_notes := 'Invalid wallet address - please verify and resubmit'
);
```

**Note**: Rejecting a withdrawal automatically refunds the user's balance.

## Security Considerations

### Admin Authentication
- Ensure only authorized admins can approve withdrawals
- Log all admin actions with user IDs
- Implement role-based access control

### Validation Checks
- Always validate TON wallet addresses
- Check user balance before approval
- Verify withdrawal limits and frequency
- Monitor for suspicious patterns

### Audit Trail
- All actions are logged in `withdrawal_logs` table
- Track who processed each withdrawal
- Maintain transaction hash records
- Keep processing notes for reference

## Monitoring and Alerts

### Key Metrics to Monitor
- Number of pending withdrawals
- Average processing time
- Rejection rates
- Failed transaction rates
- Daily withdrawal volumes

### Automated Alerts
Consider setting up alerts for:
- High volume of pending withdrawals
- Failed TON transactions
- Unusual withdrawal patterns
- System errors in processing

## Best Practices

### Processing Efficiency
1. **Batch Processing**: Use batch approval for multiple withdrawals
2. **Regular Reviews**: Check pending withdrawals every few hours
3. **Quick Response**: Process withdrawals within 24 hours
4. **Clear Communication**: Provide clear rejection reasons

### Risk Management
1. **Verify Addresses**: Always validate TON wallet addresses
2. **Check Balances**: Ensure sufficient user balance
3. **Monitor Limits**: Respect daily/monthly withdrawal limits
4. **Document Everything**: Keep detailed processing notes

### User Experience
1. **Fast Processing**: Aim for quick approval times
2. **Clear Status**: Keep users informed of withdrawal status
3. **Helpful Rejections**: Provide actionable feedback for rejections
4. **Support**: Offer help for failed transactions

## Troubleshooting

### Common Issues

#### Withdrawal Not Found
```sql
-- Check if withdrawal exists
SELECT * FROM withdrawals WHERE id = 123;
```

#### User Balance Issues
```sql
-- Check user's current balance
SELECT id, telegram_id, balance, available_earnings 
FROM users WHERE id = (SELECT user_id FROM withdrawals WHERE id = 123);
```

#### Transaction Hash Issues
- Verify the transaction hash is correct
- Check if the TON transaction was successful
- Ensure the amount matches the withdrawal amount

### Recovery Procedures

#### Failed TON Transaction
1. Mark withdrawal as failed
2. Refund user balance
3. Notify user of the issue
4. Provide support for retry

#### Incorrect Transaction Hash
1. Update the withdrawal record with correct hash
2. Add processing notes explaining the correction
3. Verify the transaction on TON blockchain

## Integration Examples

### Express.js Route Setup
```javascript
const express = require('express');
const {
  getPendingWithdrawalsHandler,
  approveWithdrawalHandler,
  completeWithdrawalHandler,
  rejectWithdrawalHandler
} = require('./api/withdrawalApi');

const router = express.Router();

router.get('/withdrawals/pending', getPendingWithdrawalsHandler);
router.post('/withdrawals/:id/approve', approveWithdrawalHandler);
router.post('/withdrawals/:id/complete', completeWithdrawalHandler);
router.post('/withdrawals/:id/reject', rejectWithdrawalHandler);

module.exports = router;
```

### React Admin Page
```tsx
import React from 'react';
import { WithdrawalAdminDashboard } from '../components/WithdrawalAdminDashboard';

const AdminWithdrawalsPage: React.FC = () => {
  const currentAdminId = 1; // Get from auth context

  return (
    <div className="admin-page">
      <h1>Withdrawal Management</h1>
      <WithdrawalAdminDashboard adminUserId={currentAdminId} />
    </div>
  );
};

export default AdminWithdrawalsPage;
```

This comprehensive system provides multiple ways to manage withdrawals efficiently while maintaining security and audit trails. Choose the method that best fits your workflow and technical setup.





