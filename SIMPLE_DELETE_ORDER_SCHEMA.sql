-- =============================================
-- SIMPLE DELETE ORDER SCHEMA FOR SUPABASE
-- =============================================
-- Run this in Supabase SQL Editor

-- 1. Function to delete order and reset user eligibility
CREATE OR REPLACE FUNCTION delete_faucet_order(
    p_order_id INTEGER
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    -- Get user_id from the order
    SELECT user_id INTO v_user_id FROM faucet_claims WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Order not found';
        RETURN;
    END IF;
    
    -- Delete the order
    DELETE FROM faucet_claims WHERE id = p_order_id;
    
    -- Reset user's claim eligibility
    UPDATE users 
    SET 
        last_faucet_claim = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RETURN QUERY SELECT true, 'Order deleted and user can claim again';
END;
$$ LANGUAGE plpgsql;

-- 2. Function to reject order and reset user eligibility
CREATE OR REPLACE FUNCTION reject_faucet_order_with_reset(
    p_order_id INTEGER,
    p_rejection_reason TEXT
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    -- Get user_id from the order
    SELECT user_id INTO v_user_id FROM faucet_claims WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Order not found';
        RETURN;
    END IF;
    
    -- Update order status to rejected
    UPDATE faucet_claims 
    SET 
        approval_status = 'rejected',
        rejection_reason = p_rejection_reason,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Reset user's claim eligibility
    UPDATE users 
    SET 
        last_faucet_claim = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RETURN QUERY SELECT true, 'Order rejected and user can claim again';
END;
$$ LANGUAGE plpgsql;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION delete_faucet_order TO authenticated;
GRANT EXECUTE ON FUNCTION reject_faucet_order_with_reset TO authenticated;

-- 4. Usage examples:
-- Delete order: SELECT * FROM delete_faucet_order(123);
-- Reject order: SELECT * FROM reject_faucet_order_with_reset(123, 'Invalid wallet address');
