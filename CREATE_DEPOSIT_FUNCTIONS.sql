-- Create deposit processing functions for Divine Mining platform

-- Function to process a deposit and update user balance
CREATE OR REPLACE FUNCTION process_deposit_v2(
    p_user_id INTEGER,
    p_amount NUMERIC,
    p_deposit_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_user users%ROWTYPE;
    v_deposit deposits%ROWTYPE;
BEGIN
    -- Get user details
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Get deposit details
    SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deposit not found: %', p_deposit_id;
    END IF;

    -- Check if deposit is already processed
    IF v_deposit.status = 'completed' THEN
        RAISE EXCEPTION 'Deposit already processed';
    END IF;

    -- Update user balance and total deposit
    UPDATE users 
    SET 
        balance = balance + p_amount,
        total_deposit = total_deposit + p_amount,
        last_deposit_time = NOW(),
        last_deposit_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Update deposit status
    UPDATE deposits 
    SET 
        status = 'completed',
        processed_at = NOW()
    WHERE id = p_deposit_id;

    -- Log the activity
    INSERT INTO user_activity_logs (
        user_id, 
        action_type, 
        amount, 
        description, 
        status,
        created_at
    ) VALUES (
        p_user_id, 
        'deposit', 
        p_amount, 
        'Deposit processed successfully', 
        'completed',
        NOW()
    );

    -- Log earning event
    INSERT INTO earning_logs (
        user_id,
        type,
        amount,
        metadata,
        timestamp
    ) VALUES (
        p_user_id,
        'deposit',
        p_amount,
        jsonb_build_object(
            'deposit_id', p_deposit_id,
            'transaction_hash', v_deposit.transaction_hash,
            'network', 'TON'
        ),
        NOW()
    );

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error
        INSERT INTO user_activity_logs (
            user_id, 
            action_type, 
            amount, 
            description, 
            status,
            created_at
        ) VALUES (
            p_user_id, 
            'deposit_error', 
            p_amount, 
            'Deposit processing failed: ' || SQLERRM, 
            'failed',
            NOW()
        );
        
        RAISE;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get user deposit history
CREATE OR REPLACE FUNCTION get_user_deposits(p_user_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    amount NUMERIC,
    status TEXT,
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.amount,
        d.status,
        d.transaction_hash,
        d.created_at,
        d.processed_at
    FROM deposits d
    WHERE d.user_id = p_user_id
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get deposit statistics
CREATE OR REPLACE FUNCTION get_deposit_stats(p_user_id INTEGER)
RETURNS TABLE (
    total_deposits INTEGER,
    total_amount NUMERIC,
    pending_deposits INTEGER,
    pending_amount NUMERIC,
    completed_deposits INTEGER,
    completed_amount NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_deposits,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending_deposits,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed_deposits,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as completed_amount
    FROM deposits
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_deposit_v2(INTEGER, NUMERIC, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_deposits(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deposit_stats(INTEGER) TO authenticated;

-- Add comments
COMMENT ON FUNCTION process_deposit_v2(INTEGER, NUMERIC, INTEGER) IS 'Process a deposit and update user balance';
COMMENT ON FUNCTION get_user_deposits(INTEGER) IS 'Get deposit history for a user';
COMMENT ON FUNCTION get_deposit_stats(INTEGER) IS 'Get deposit statistics for a user'; 