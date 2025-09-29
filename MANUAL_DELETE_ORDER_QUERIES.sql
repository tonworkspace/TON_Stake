-- =============================================
-- MANUAL DELETE ORDER QUERIES FOR SUPABASE
-- =============================================
-- Use these queries directly in Supabase SQL Editor

-- =============================================
-- 1. DELETE ORDER COMPLETELY (User can try again)
-- =============================================

-- Step 1: Get order details
SELECT 
    id,
    user_id,
    telegram_username,
    claim_amount,
    approval_status,
    claimed_at
FROM faucet_claims 
WHERE id = YOUR_ORDER_ID_HERE;

-- Step 2: Delete the order
DELETE FROM faucet_claims 
WHERE id = YOUR_ORDER_ID_HERE;

-- Step 3: Reset user eligibility
UPDATE users 
SET 
    last_faucet_claim = NULL,
    updated_at = NOW()
WHERE id = (SELECT user_id FROM faucet_claims WHERE id = YOUR_ORDER_ID_HERE);

-- =============================================
-- 2. REJECT ORDER (User can try again)
-- =============================================

-- Step 1: Get order details
SELECT 
    id,
    user_id,
    telegram_username,
    claim_amount,
    approval_status
FROM faucet_claims 
WHERE id = YOUR_ORDER_ID_HERE;

-- Step 2: Reject the order
UPDATE faucet_claims 
SET 
    approval_status = 'rejected',
    rejection_reason = 'YOUR_REJECTION_REASON_HERE',
    approved_at = NOW(),
    updated_at = NOW()
WHERE id = YOUR_ORDER_ID_HERE;

-- Step 3: Reset user eligibility
UPDATE users 
SET 
    last_faucet_claim = NULL,
    updated_at = NOW()
WHERE id = (SELECT user_id FROM faucet_claims WHERE id = YOUR_ORDER_ID_HERE);

-- =============================================
-- 3. CHECK USER ELIGIBILITY
-- =============================================

-- Check if user can claim
SELECT 
    fc.user_id,
    u.telegram_username,
    COUNT(*) as total_claims,
    COUNT(CASE WHEN fc.approval_status = 'pending' THEN 1 END) as pending_claims,
    COUNT(CASE WHEN fc.approval_status = 'approved' THEN 1 END) as approved_claims,
    COUNT(CASE WHEN fc.approval_status = 'rejected' THEN 1 END) as rejected_claims,
    CASE 
        WHEN COUNT(CASE WHEN fc.approval_status IN ('pending', 'approved') THEN 1 END) > 0 
        THEN 'Cannot claim - has active claims'
        WHEN COUNT(CASE WHEN fc.approval_status = 'rejected' THEN 1 END) > 0 
        THEN 'Can claim - only has rejected claims'
        ELSE 'Can claim - no previous claims'
    END as eligibility_status
FROM faucet_claims fc
LEFT JOIN users u ON fc.user_id = u.id
WHERE fc.user_id = YOUR_USER_ID_HERE
GROUP BY fc.user_id, u.telegram_username;

-- =============================================
-- 4. BULK OPERATIONS
-- =============================================

-- Delete all rejected orders older than 30 days
DELETE FROM faucet_claims 
WHERE approval_status = 'rejected' 
AND approved_at < NOW() - INTERVAL '30 days';

-- Reset eligibility for users with only rejected claims
UPDATE users 
SET 
    last_faucet_claim = NULL,
    updated_at = NOW()
WHERE id IN (
    SELECT DISTINCT fc.user_id
    FROM faucet_claims fc
    WHERE fc.user_id NOT IN (
        SELECT DISTINCT user_id 
        FROM faucet_claims 
        WHERE approval_status IN ('pending', 'approved')
    )
    AND fc.user_id IN (
        SELECT DISTINCT user_id 
        FROM faucet_claims 
        WHERE approval_status = 'rejected'
    )
);

-- =============================================
-- 5. ADMIN QUERIES
-- =============================================

-- Get all pending orders
SELECT 
    fc.id,
    fc.user_id,
    fc.telegram_username,
    fc.telegram_first_name,
    fc.claim_amount,
    fc.portfolio_value,
    fc.claimed_at
FROM faucet_claims fc
WHERE fc.approval_status = 'pending'
ORDER BY fc.claimed_at ASC;

-- Get all rejected orders
SELECT 
    fc.id,
    fc.user_id,
    fc.telegram_username,
    fc.telegram_first_name,
    fc.claim_amount,
    fc.rejection_reason,
    fc.approved_at
FROM faucet_claims fc
WHERE fc.approval_status = 'rejected'
ORDER BY fc.approved_at DESC;

-- Get user claim history
SELECT 
    fc.id,
    fc.claim_amount,
    fc.approval_status,
    fc.rejection_reason,
    fc.claimed_at,
    fc.approved_at
FROM faucet_claims fc
WHERE fc.user_id = YOUR_USER_ID_HERE
ORDER BY fc.claimed_at DESC;

-- =============================================
-- 6. MAINTENANCE QUERIES
-- =============================================

-- Get statistics
SELECT 
    'Total Orders' as metric,
    COUNT(*) as count
FROM faucet_claims
UNION ALL
SELECT 
    'Pending Orders',
    COUNT(*)
FROM faucet_claims
WHERE approval_status = 'pending'
UNION ALL
SELECT 
    'Approved Orders',
    COUNT(*)
FROM faucet_claims
WHERE approval_status = 'approved'
UNION ALL
SELECT 
    'Rejected Orders',
    COUNT(*)
FROM faucet_claims
WHERE approval_status = 'rejected';

-- Get users who can claim again
SELECT 
    u.id,
    u.telegram_username,
    COUNT(fc.id) as rejected_claims,
    MAX(fc.approved_at) as last_rejection_date
FROM users u
JOIN faucet_claims fc ON u.id = fc.user_id
WHERE fc.approval_status = 'rejected'
AND u.id NOT IN (
    SELECT DISTINCT user_id 
    FROM faucet_claims 
    WHERE approval_status IN ('pending', 'approved')
)
GROUP BY u.id, u.telegram_username
ORDER BY last_rejection_date DESC;
