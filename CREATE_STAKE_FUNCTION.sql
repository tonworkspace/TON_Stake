-- Create the create_stake function for the staking system
-- Run this in your Supabase SQL Editor

-- Function to create a new stake
CREATE OR REPLACE FUNCTION create_stake(
    p_user_id INTEGER,
    p_amount NUMERIC,
    p_daily_rate NUMERIC,
    p_tier_name VARCHAR(100)
) RETURNS INTEGER AS $$
DECLARE
    v_stake_id INTEGER;
    v_user users%ROWTYPE;
BEGIN
    -- Get user details
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Check if user has enough balance
    IF v_user.balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', p_amount, v_user.balance;
    END IF;

    -- Create new stake
    INSERT INTO stakes (
        user_id,
        amount,
        daily_rate,
        start_date,
        last_payout,
        is_active,
        speed_boost_active,
        cycle_progress
    ) VALUES (
        p_user_id,
        p_amount,
        p_daily_rate,
        NOW(),
        NOW(),
        true,
        false,
        0
    ) RETURNING id INTO v_stake_id;

    -- Update user balance
    UPDATE users 
    SET 
        balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;

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
        'stake_created', 
        p_amount, 
        'Created ' || p_tier_name || ' stake', 
        'completed',
        NOW()
    );

    RETURN v_stake_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_stake(INTEGER, NUMERIC, NUMERIC, VARCHAR(100)) TO authenticated;

-- Verify the function was created
SELECT 
    routine_name, 
    routine_type,
    data_type,
    '✅ Function created successfully' as status
FROM information_schema.routines 
WHERE routine_name = 'create_stake';

-- Test the function (optional - remove this if you don't want to test)
-- SELECT create_stake(1, 10, 0.01, 'Test Tier'); 