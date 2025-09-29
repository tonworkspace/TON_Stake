-- =============================================
-- ADD ORDER APPROVAL SYSTEM
-- =============================================
-- This script adds approval status tracking to the faucet claims system

-- Add approval status columns to faucet_claims table
ALTER TABLE faucet_claims 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'processing')),
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS payment_tx_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_network VARCHAR(20) DEFAULT 'mainnet',
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(18, 6),
ADD COLUMN IF NOT EXISTS payment_processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create index for faster approval queries
CREATE INDEX IF NOT EXISTS idx_faucet_claims_approval_status ON faucet_claims(approval_status);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_payment_status ON faucet_claims(payment_status);
CREATE INDEX IF NOT EXISTS idx_faucet_claims_approved_at ON faucet_claims(approved_at);

-- Create function to approve an order
CREATE OR REPLACE FUNCTION approve_faucet_order(
    p_order_id INTEGER,
    p_approved_by INTEGER,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Get the order
    SELECT * INTO v_order FROM faucet_claims WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Order not found';
        RETURN;
    END IF;
    
    IF v_order.approval_status = 'approved' THEN
        RETURN QUERY SELECT false, 'Order already approved';
        RETURN;
    END IF;
    
    -- Approve the order
    UPDATE faucet_claims 
    SET 
        approval_status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        admin_notes = p_admin_notes,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN QUERY SELECT true, 'Order approved successfully';
END;
$$ LANGUAGE plpgsql;

-- Create function to reject an order
CREATE OR REPLACE FUNCTION reject_faucet_order(
    p_order_id INTEGER,
    p_approved_by INTEGER,
    p_rejection_reason TEXT,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Get the order
    SELECT * INTO v_order FROM faucet_claims WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Order not found';
        RETURN;
    END IF;
    
    IF v_order.approval_status = 'rejected' THEN
        RETURN QUERY SELECT false, 'Order already rejected';
        RETURN;
    END IF;
    
    -- Reject the order
    UPDATE faucet_claims 
    SET 
        approval_status = 'rejected',
        approved_by = p_approved_by,
        approved_at = NOW(),
        rejection_reason = p_rejection_reason,
        admin_notes = p_admin_notes,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN QUERY SELECT true, 'Order rejected successfully';
END;
$$ LANGUAGE plpgsql;

-- Create function to update payment status
CREATE OR REPLACE FUNCTION update_payment_status(
    p_order_id INTEGER,
    p_payment_status VARCHAR(20),
    p_payment_tx_hash VARCHAR(255) DEFAULT NULL,
    p_payment_amount DECIMAL(18, 6) DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Get the order
    SELECT * INTO v_order FROM faucet_claims WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Order not found';
        RETURN;
    END IF;
    
    -- Update payment status
    UPDATE faucet_claims 
    SET 
        payment_status = p_payment_status,
        payment_tx_hash = p_payment_tx_hash,
        payment_amount = COALESCE(p_payment_amount, claim_amount),
        payment_processed_at = CASE 
            WHEN p_payment_status = 'completed' THEN NOW()
            ELSE payment_processed_at
        END,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN QUERY SELECT true, 'Payment status updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Create view for pending orders (for admin review)
CREATE OR REPLACE VIEW pending_faucet_orders AS
SELECT 
    fc.id,
    fc.user_id,
    fc.wallet_address,
    fc.claim_amount,
    fc.claimed_at,
    fc.telegram_id,
    fc.telegram_username,
    fc.telegram_first_name,
    fc.telegram_last_name,
    fc.portfolio_value,
    fc.approval_status,
    fc.payment_status,
    fc.admin_notes,
    u.username as user_username
FROM faucet_claims fc
LEFT JOIN users u ON fc.user_id = u.id
WHERE fc.approval_status = 'pending'
ORDER BY fc.claimed_at ASC;

-- Create view for approved orders (for payment processing)
CREATE OR REPLACE VIEW approved_faucet_orders AS
SELECT 
    fc.id,
    fc.user_id,
    fc.wallet_address,
    fc.claim_amount,
    fc.claimed_at,
    fc.approved_at,
    fc.payment_status,
    fc.payment_tx_hash,
    fc.payment_amount,
    fc.telegram_id,
    fc.telegram_username,
    fc.telegram_first_name,
    fc.telegram_last_name,
    u.username as user_username
FROM faucet_claims fc
LEFT JOIN users u ON fc.user_id = u.id
WHERE fc.approval_status = 'approved'
ORDER BY fc.approved_at ASC;

-- Create view for user order status (for users to check their orders)
CREATE OR REPLACE VIEW user_order_status AS
SELECT 
    fc.id,
    fc.user_id,
    fc.claim_amount,
    fc.claimed_at,
    fc.approval_status,
    fc.approved_at,
    fc.payment_status,
    fc.payment_tx_hash,
    fc.payment_amount,
    fc.payment_processed_at,
    fc.rejection_reason,
    fc.admin_notes,
    CASE 
        WHEN fc.approval_status = 'pending' THEN '⏳ Pending Approval'
        WHEN fc.approval_status = 'approved' AND fc.payment_status = 'pending' THEN '✅ Approved - Processing Payment'
        WHEN fc.approval_status = 'approved' AND fc.payment_status = 'processing' THEN '🔄 Payment in Progress'
        WHEN fc.approval_status = 'approved' AND fc.payment_status = 'completed' THEN '🎉 Payment Completed'
        WHEN fc.approval_status = 'approved' AND fc.payment_status = 'failed' THEN '❌ Payment Failed'
        WHEN fc.approval_status = 'rejected' THEN '❌ Rejected'
        ELSE '❓ Unknown Status'
    END as status_description
FROM faucet_claims fc
ORDER BY fc.claimed_at DESC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_faucet_order TO authenticated;
GRANT EXECUTE ON FUNCTION reject_faucet_order TO authenticated;
GRANT EXECUTE ON FUNCTION update_payment_status TO authenticated;
GRANT SELECT ON pending_faucet_orders TO authenticated;
GRANT SELECT ON approved_faucet_orders TO authenticated;
GRANT SELECT ON user_order_status TO authenticated;

-- Add comments
COMMENT ON COLUMN faucet_claims.approval_status IS 'Order approval status: pending, approved, rejected, processing';
COMMENT ON COLUMN faucet_claims.approved_by IS 'User ID of admin who approved/rejected the order';
COMMENT ON COLUMN faucet_claims.approved_at IS 'Timestamp when order was approved/rejected';
COMMENT ON COLUMN faucet_claims.rejection_reason IS 'Reason for rejection if applicable';
COMMENT ON COLUMN faucet_claims.payment_status IS 'Payment processing status: pending, processing, completed, failed';
COMMENT ON COLUMN faucet_claims.payment_tx_hash IS 'Blockchain transaction hash for payment';
COMMENT ON COLUMN faucet_claims.payment_network IS 'Network used for payment (mainnet/testnet)';
COMMENT ON COLUMN faucet_claims.payment_amount IS 'Actual amount paid (may differ from claim amount)';
COMMENT ON COLUMN faucet_claims.payment_processed_at IS 'Timestamp when payment was completed';
COMMENT ON COLUMN faucet_claims.admin_notes IS 'Internal admin notes for the order';

-- Success message
SELECT 'Approval system added successfully' as status;
