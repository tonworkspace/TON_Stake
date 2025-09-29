# Delete Order Schema Setup Guide

## 🚀 Quick Setup (Recommended)

### Step 1: Run the Simple Schema
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `SIMPLE_DELETE_ORDER_SCHEMA.sql`
3. Click **Run** to execute the schema

### Step 2: Test the Functions
```sql
-- Test delete function
SELECT * FROM delete_faucet_order(123);

-- Test reject function  
SELECT * FROM reject_faucet_order_with_reset(123, 'Invalid wallet address');
```

## 📋 Complete Setup (Advanced)

### Step 1: Run the Complete Schema
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `DELETE_ORDER_SCHEMA.sql`
3. Click **Run** to execute the schema

### Step 2: Verify Functions
```sql
-- Check if functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%faucet%';
```

## 🔧 Manual Operations (No Functions)

If you prefer to run queries manually:

### Delete Order
```sql
-- 1. Get order details
SELECT id, user_id, telegram_username, claim_amount 
FROM faucet_claims WHERE id = 123;

-- 2. Delete order
DELETE FROM faucet_claims WHERE id = 123;

-- 3. Reset user eligibility
UPDATE users 
SET last_faucet_claim = NULL, updated_at = NOW()
WHERE id = (SELECT user_id FROM faucet_claims WHERE id = 123);
```

### Reject Order
```sql
-- 1. Reject order
UPDATE faucet_claims 
SET 
    approval_status = 'rejected',
    rejection_reason = 'Invalid wallet address',
    approved_at = NOW(),
    updated_at = NOW()
WHERE id = 123;

-- 2. Reset user eligibility
UPDATE users 
SET last_faucet_claim = NULL, updated_at = NOW()
WHERE id = (SELECT user_id FROM faucet_claims WHERE id = 123);
```

## 🎯 Usage Examples

### In Admin Dashboard
The admin dashboard will automatically use the new functions if available, with fallback to manual operations.

### Direct Database Access
```sql
-- Delete order ID 123
SELECT * FROM delete_faucet_order(123);

-- Reject order ID 123 with reason
SELECT * FROM reject_faucet_order_with_reset(123, 'Invalid portfolio data');

-- Check user eligibility
SELECT * FROM check_user_claim_eligibility(456);
```

## 🔍 Monitoring & Maintenance

### Check Order Statistics
```sql
SELECT 
    approval_status,
    COUNT(*) as count,
    SUM(claim_amount) as total_amount
FROM faucet_claims 
GROUP BY approval_status;
```

### Find Users Who Can Claim Again
```sql
SELECT 
    u.id,
    u.telegram_username,
    COUNT(fc.id) as rejected_claims
FROM users u
JOIN faucet_claims fc ON u.id = fc.user_id
WHERE fc.approval_status = 'rejected'
AND u.id NOT IN (
    SELECT DISTINCT user_id 
    FROM faucet_claims 
    WHERE approval_status IN ('pending', 'approved')
)
GROUP BY u.id, u.telegram_username;
```

### Clean Up Old Rejected Orders
```sql
-- Delete rejected orders older than 30 days
DELETE FROM faucet_claims 
WHERE approval_status = 'rejected' 
AND approved_at < NOW() - INTERVAL '30 days';
```

## ⚠️ Important Notes

1. **Backup First**: Always backup your database before running schema changes
2. **Test Functions**: Test the functions with non-critical data first
3. **Permissions**: Ensure authenticated users have execute permissions on functions
4. **Monitoring**: Monitor the audit tables for tracking deletions/rejections

## 🆘 Troubleshooting

### Function Not Found Error
```sql
-- Check if function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'delete_faucet_order';
```

### Permission Denied Error
```sql
-- Grant permissions
GRANT EXECUTE ON FUNCTION delete_faucet_order TO authenticated;
GRANT EXECUTE ON FUNCTION reject_faucet_order_with_reset TO authenticated;
```

### User Still Can't Claim
```sql
-- Check user's claim status
SELECT 
    fc.user_id,
    fc.approval_status,
    fc.claimed_at,
    u.last_faucet_claim
FROM faucet_claims fc
JOIN users u ON fc.user_id = u.id
WHERE fc.user_id = YOUR_USER_ID;
```
