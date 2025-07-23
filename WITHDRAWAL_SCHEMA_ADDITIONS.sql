-- Schema additions for enhanced withdrawal functionality
-- Run this after the main schema.sql

-- Add wallet_address field to existing withdrawals table
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Create withdrawal_logs table for detailed logging and tracking
CREATE TABLE IF NOT EXISTS withdrawal_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    withdrawal_id INTEGER REFERENCES withdrawals(id) NOT NULL,
    amount NUMERIC NOT NULL,
    wallet_amount NUMERIC NOT NULL,
    fees JSONB NOT NULL, -- Store fee breakdown as JSON
    wallet_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_by INTEGER REFERENCES users(id), -- Admin who processed it
    processing_notes TEXT,
    CONSTRAINT valid_log_status CHECK (status IN ('submitted', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_wallet_address ON withdrawals(wallet_address);
CREATE INDEX IF NOT EXISTS idx_withdrawal_logs_user_id ON withdrawal_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_logs_withdrawal_id ON withdrawal_logs(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_logs_status ON withdrawal_logs(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_logs_timestamp ON withdrawal_logs(timestamp);

-- Add comments for documentation
COMMENT ON COLUMN withdrawals.wallet_address IS 'TON wallet address where funds should be sent';
COMMENT ON TABLE withdrawal_logs IS 'Detailed logs for withdrawal requests including fee breakdown and processing status';
COMMENT ON COLUMN withdrawal_logs.fees IS 'JSON object containing fee breakdown: {glp: amount, stk: amount, reinvest: amount}';

-- Create view for withdrawal management (admin dashboard)
CREATE OR REPLACE VIEW withdrawal_management_view AS
SELECT 
    w.id,
    w.user_id,
    u.telegram_id,
    u.username,
    u.first_name,
    u.last_name,
    w.amount as total_amount,
    w.wallet_amount,
    w.redeposit_amount as reinvest_amount,
    w.sbt_amount as stk_amount,
    w.wallet_address,
    w.status,
    w.created_at as requested_at,
    w.processed_at,
    w.transaction_hash,
    wl.fees as fee_breakdown,
    wl.processing_notes,
    wl.processed_by,
    -- Calculate fee percentages for validation
    ROUND((w.amount - w.wallet_amount) / w.amount * 100, 2) as total_fee_percentage,
    ROUND(w.redeposit_amount / w.amount * 100, 2) as reinvest_percentage,
    ROUND(w.sbt_amount / w.amount * 100, 2) as stk_percentage
FROM withdrawals w
JOIN users u ON w.user_id = u.id
LEFT JOIN withdrawal_logs wl ON w.id = wl.withdrawal_id
ORDER BY w.created_at DESC;

-- Function to update withdrawal status with logging
CREATE OR REPLACE FUNCTION update_withdrawal_status(
    p_withdrawal_id INTEGER,
    p_status TEXT,
    p_transaction_hash TEXT DEFAULT NULL,
    p_processing_notes TEXT DEFAULT NULL,
    p_processed_by INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_withdrawal withdrawals%ROWTYPE;
BEGIN
    -- Get withdrawal details
    SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal not found';
    END IF;

    -- Update withdrawal status
    UPDATE withdrawals 
    SET status = p_status,
        processed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE processed_at END,
        transaction_hash = COALESCE(p_transaction_hash, transaction_hash)
    WHERE id = p_withdrawal_id;

    -- Log the status update
    UPDATE withdrawal_logs 
    SET status = p_status,
        processing_notes = COALESCE(p_processing_notes, processing_notes),
        processed_by = COALESCE(p_processed_by, processed_by)
    WHERE withdrawal_id = p_withdrawal_id;

    -- If withdrawal is cancelled or failed, refund the user's balance
    IF p_status IN ('cancelled', 'failed') THEN
        UPDATE users 
        SET balance = balance + v_withdrawal.amount
        WHERE id = v_withdrawal.user_id;
        
        -- Log the refund
        INSERT INTO earning_logs (user_id, type, amount, metadata) VALUES (
            v_withdrawal.user_id, 
            'refund', 
            v_withdrawal.amount,
            jsonb_build_object('reason', 'withdrawal_' || p_status, 'withdrawal_id', p_withdrawal_id)
        );
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get withdrawal statistics
CREATE OR REPLACE FUNCTION get_withdrawal_stats(
    p_user_id INTEGER DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
    v_where_clause TEXT := '1=1';
BEGIN
    -- Build dynamic where clause
    IF p_user_id IS NOT NULL THEN
        v_where_clause := v_where_clause || ' AND user_id = ' || p_user_id;
    END IF;
    
    IF p_start_date IS NOT NULL THEN
        v_where_clause := v_where_clause || ' AND created_at >= ''' || p_start_date || '''';
    END IF;
    
    IF p_end_date IS NOT NULL THEN
        v_where_clause := v_where_clause || ' AND created_at <= ''' || p_end_date || ' 23:59:59''';
    END IF;

    -- Execute dynamic query
    EXECUTE format('
        SELECT jsonb_build_object(
            ''total_requests'', COUNT(*),
            ''total_amount'', COALESCE(SUM(amount), 0),
            ''total_wallet_amount'', COALESCE(SUM(wallet_amount), 0),
            ''total_fees'', COALESCE(SUM(amount - wallet_amount), 0),
            ''pending_count'', COUNT(*) FILTER (WHERE status = ''pending''),
            ''processing_count'', COUNT(*) FILTER (WHERE status = ''processing''),
            ''completed_count'', COUNT(*) FILTER (WHERE status = ''completed''),
            ''failed_count'', COUNT(*) FILTER (WHERE status = ''failed''),
            ''average_amount'', COALESCE(AVG(amount), 0),
            ''success_rate'', CASE 
                WHEN COUNT(*) > 0 THEN 
                    ROUND((COUNT(*) FILTER (WHERE status = ''completed'')::NUMERIC / COUNT(*)) * 100, 2)
                ELSE 0 
            END
        )
        FROM withdrawals 
        WHERE %s
    ', v_where_clause) INTO v_stats;

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the new tables and functions
GRANT SELECT, INSERT, UPDATE ON withdrawal_logs TO authenticated;
GRANT SELECT ON withdrawal_management_view TO authenticated;

-- Enable RLS for withdrawal_logs
ALTER TABLE withdrawal_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for withdrawal_logs
CREATE POLICY "Users can view their own withdrawal logs" ON withdrawal_logs
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::INTEGER);

CREATE POLICY "Admins can manage all withdrawal logs" ON withdrawal_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_setting('app.current_user_id')::INTEGER 
            AND rank IN ('admin', 'super_admin')
        )
    );

-- Add helpful constraints and triggers
ALTER TABLE withdrawal_logs 
ADD CONSTRAINT valid_fees_json CHECK (
    fees ? 'glp' AND 
    fees ? 'stk' AND 
    fees ? 'reinvest' AND
    (fees->>'glp')::NUMERIC >= 0 AND
    (fees->>'stk')::NUMERIC >= 0 AND
    (fees->>'reinvest')::NUMERIC >= 0
);

-- Create trigger to automatically update withdrawal_logs when withdrawals status changes
CREATE OR REPLACE FUNCTION sync_withdrawal_log_status() RETURNS TRIGGER AS $$
BEGIN
    UPDATE withdrawal_logs 
    SET status = NEW.status
    WHERE withdrawal_id = NEW.id AND status != NEW.status;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_withdrawal_status_trigger
    AFTER UPDATE OF status ON withdrawals
    FOR EACH ROW
    EXECUTE FUNCTION sync_withdrawal_log_status(); 