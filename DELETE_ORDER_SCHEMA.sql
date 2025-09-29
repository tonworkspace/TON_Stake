-- =============================================
-- DELETE ORDER SCHEMA FOR SUPABASE
-- =============================================
-- This schema provides functions to safely delete orders and reset user eligibility

-- 1. Create function to delete order and reset user eligibility
CREATE OR REPLACE FUNCTION delete_faucet_order(
    p_order_id INTEGER,
    p_admin_id INTEGER DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    user_id INTEGER,
    order_id INTEGER
) AS $$
DECLARE
    v_order RECORD;
    v_user_id INTEGER;
BEGIN
    -- Get the order details
    SELECT * INTO v_order FROM faucet_claims WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Order not found', NULL::INTEGER, p_order_id;
        RETURN;
    END IF;
    
    v_user_id := v_order.user_id;
    
    -- Delete the order from faucet_claims table
    DELETE FROM faucet_claims WHERE id = p_order_id;
    
    -- Reset user's claim eligibility
    UPDATE users 
    SET 
        last_faucet_claim = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    -- Log the deletion (optional - create audit table if needed)
    -- INSERT INTO order_deletions (order_id, user_id, deleted_by, deleted_at, admin_notes)
    -- VALUES (p_order_id, v_user_id, p_admin_id, NOW(), p_admin_notes);
    
    RETURN QUERY SELECT true, 'Order deleted successfully and user eligibility reset', v_user_id, p_order_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to reject order and reset user eligibility
CREATE OR REPLACE FUNCTION reject_faucet_order_with_reset(
    p_order_id INTEGER,
    p_approved_by INTEGER,
    p_rejection_reason TEXT,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    user_id INTEGER,
    order_id INTEGER
) AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    -- Get user_id from the order
    SELECT user_id INTO v_user_id FROM faucet_claims WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Order not found', NULL::INTEGER, p_order_id;
        RETURN;
    END IF;
    
    -- Update the order status to rejected
    UPDATE faucet_claims 
    SET 
        approval_status = 'rejected',
        approved_by = p_approved_by,
        approved_at = NOW(),
        rejection_reason = p_rejection_reason,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Reset user's claim eligibility so they can try again
    UPDATE users 
    SET 
        last_faucet_claim = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RETURN QUERY SELECT true, 'Order rejected and user eligibility reset', v_user_id, p_order_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to check user claim eligibility
CREATE OR REPLACE FUNCTION check_user_claim_eligibility(p_user_id INTEGER)
RETURNS TABLE(
    can_claim BOOLEAN,
    has_active_claims BOOLEAN,
    has_rejected_claims BOOLEAN,
    rejection_reason TEXT,
    active_claim_count INTEGER,
    rejected_claim_count INTEGER
) AS $$
DECLARE
    v_active_count INTEGER := 0;
    v_rejected_count INTEGER := 0;
    v_latest_rejection TEXT;
BEGIN
    -- Count active claims (pending or approved)
    SELECT COUNT(*) INTO v_active_count
    FROM faucet_claims 
    WHERE user_id = p_user_id 
    AND approval_status IN ('pending', 'approved');
    
    -- Count rejected claims
    SELECT COUNT(*) INTO v_rejected_count
    FROM faucet_claims 
    WHERE user_id = p_user_id 
    AND approval_status = 'rejected';
    
    -- Get latest rejection reason
    SELECT rejection_reason INTO v_latest_rejection
    FROM faucet_claims 
    WHERE user_id = p_user_id 
    AND approval_status = 'rejected'
    ORDER BY approved_at DESC
    LIMIT 1;
    
    RETURN QUERY SELECT 
        (v_active_count = 0), -- Can claim if no active claims
        (v_active_count > 0), -- Has active claims
        (v_rejected_count > 0), -- Has rejected claims
        v_latest_rejection, -- Latest rejection reason
        v_active_count, -- Active claim count
        v_rejected_count; -- Rejected claim count
END;
$$ LANGUAGE plpgsql;

-- 4. Create audit table for order deletions (optional but recommended)
CREATE TABLE IF NOT EXISTS order_deletions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    deleted_by INTEGER,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admin_notes TEXT,
    deletion_reason TEXT DEFAULT 'admin_deletion',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create audit table for order rejections (optional but recommended)
CREATE TABLE IF NOT EXISTS order_rejections (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rejected_by INTEGER NOT NULL,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rejection_reason TEXT NOT NULL,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION delete_faucet_order TO authenticated;
GRANT EXECUTE ON FUNCTION reject_faucet_order_with_reset TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_claim_eligibility TO authenticated;
GRANT SELECT, INSERT ON order_deletions TO authenticated;
GRANT SELECT, INSERT ON order_rejections TO authenticated;

-- 7. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_faucet_claims_user_status ON faucet_claims(user_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_approval_status ON faucet_claims(approval_status);
CREATE INDEX IF NOT EXISTS idx_order_deletions_user_id ON order_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_order_rejections_user_id ON order_rejections(user_id);

-- 8. Add comments for documentation
COMMENT ON FUNCTION delete_faucet_order IS 'Deletes a faucet order and resets user eligibility to allow new claims';
COMMENT ON FUNCTION reject_faucet_order_with_reset IS 'Rejects a faucet order and resets user eligibility to allow new claims';
COMMENT ON FUNCTION check_user_claim_eligibility IS 'Checks if a user can submit a new claim based on their order history';
COMMENT ON TABLE order_deletions IS 'Audit trail for deleted orders';
COMMENT ON TABLE order_rejections IS 'Audit trail for rejected orders';

-- =============================================
-- USAGE EXAMPLES
-- =============================================

-- Example 1: Delete an order (admin action)
-- SELECT * FROM delete_faucet_order(123, 456, 'Order deleted due to invalid data');

-- Example 2: Reject an order with reset (admin action)
-- SELECT * FROM reject_faucet_order_with_reset(123, 456, 'Invalid wallet address', 'User provided wrong wallet');

-- Example 3: Check if user can claim (frontend check)
-- SELECT * FROM check_user_claim_eligibility(789);

-- Example 4: Get all deleted orders for a user
-- SELECT * FROM order_deletions WHERE user_id = 789 ORDER BY deleted_at DESC;

-- Example 5: Get all rejected orders for a user
-- SELECT * FROM order_rejections WHERE user_id = 789 ORDER BY rejected_at DESC;

-- =============================================
-- CLEANUP QUERIES (for maintenance)
-- =============================================

-- Clean up old audit records (run periodically)
-- DELETE FROM order_deletions WHERE deleted_at < NOW() - INTERVAL '1 year';
-- DELETE FROM order_rejections WHERE rejected_at < NOW() - INTERVAL '1 year';

-- Get statistics
-- SELECT 
--     COUNT(*) as total_orders,
--     COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_orders,
--     COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_orders,
--     COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_orders
-- FROM faucet_claims;

-- Get user claim statistics
-- SELECT 
--     user_id,
--     COUNT(*) as total_claims,
--     COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_claims,
--     COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_claims,
--     MAX(claimed_at) as last_claim_date
-- FROM faucet_claims 
-- GROUP BY user_id 
-- ORDER BY total_claims DESC;
