-- WITHDRAWAL SYSTEM USAGE EXAMPLES
-- Use these corrected examples instead of the placeholders

-- 1. View all pending withdrawal requests
SELECT * FROM withdrawal_management_view WHERE status = 'pending';

-- 2. View withdrawal requests for a specific user
SELECT * FROM withdrawal_management_view WHERE telegram_id = 123456789;

-- 3. Update withdrawal status to processing (no admin user needed)
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,  -- Replace with actual withdrawal ID
    p_status := 'processing',
    p_processing_notes := 'Processing withdrawal request',
    p_processed_by := NULL  -- Optional: use actual admin user ID if available
);

-- 4. Complete withdrawal with transaction hash
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,  -- Replace with actual withdrawal ID
    p_status := 'completed',
    p_transaction_hash := 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG',
    p_processing_notes := 'Successfully sent to TON wallet',
    p_processed_by := NULL  -- Optional: use actual admin user ID if available
);

-- 5. Cancel/reject a withdrawal (this will auto-refund the user)
SELECT update_withdrawal_status(
    p_withdrawal_id := 123,  -- Replace with actual withdrawal ID
    p_status := 'failed',
    p_processing_notes := 'Insufficient funds or invalid wallet address',
    p_processed_by := NULL  -- Optional: use actual admin user ID if available
);

-- 6. Get withdrawal statistics for all users
SELECT get_withdrawal_stats();

-- 7. Get withdrawal statistics for a specific date range
SELECT get_withdrawal_stats(
    p_start_date := '2024-01-01',
    p_end_date := '2024-01-31'
);

-- 8. Get withdrawal statistics for a specific user
SELECT get_withdrawal_stats(
    p_user_id := 456  -- Replace with actual user ID from users table
);

-- 9. Find user ID by telegram ID (if you need it)
SELECT id, username, telegram_id FROM users WHERE telegram_id = 123456789;

-- 10. View recent withdrawal activities with user details
SELECT 
    wl.id,
    u.telegram_id,
    u.username,
    wl.amount,
    wl.wallet_amount,
    wl.fees,
    wl.wallet_address,
    wl.status,
    wl.timestamp,
    wl.processing_notes
FROM withdrawal_logs wl
JOIN users u ON wl.user_id = u.id
ORDER BY wl.timestamp DESC
LIMIT 50;

-- ADMIN WORKFLOW EXAMPLE:
-- Step 1: Check pending withdrawals
SELECT * FROM withdrawal_management_view WHERE status = 'pending';

-- Step 2: Update to processing
SELECT update_withdrawal_status(123, 'processing', NULL, 'Starting withdrawal process');

-- Step 3: Process the actual TON transaction (outside database)
-- Send TON to the wallet_address shown in the withdrawal record

-- Step 4: Mark as completed with transaction hash
SELECT update_withdrawal_status(
    123, 
    'completed', 
    'your_ton_transaction_hash_here',
    'TON sent successfully'
);

-- ERROR HANDLING:
-- If something goes wrong, mark as failed (this auto-refunds the user)
SELECT update_withdrawal_status(
    123, 
    'failed', 
    NULL,
    'Transaction failed - wallet address invalid'
); 