-- Safe creation of referral system functions
-- This script handles existing functions properly

-- Function to safely drop and recreate functions
DO $$
BEGIN
    -- Drop functions if they exist
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_referral' AND pronargs = 2) THEN
        DROP FUNCTION create_referral(INTEGER, INTEGER);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_rewards' AND pronargs = 3) THEN
        DROP FUNCTION process_referral_rewards(JSON, NUMERIC, JSON);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_team_volume' AND pronargs = 2) THEN
        DROP FUNCTION increment_team_volume(INTEGER, NUMERIC);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_stk_balance' AND pronargs = 3) THEN
        DROP FUNCTION add_stk_balance(INTEGER, NUMERIC, TEXT);
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_increment_referrals_function' AND pronargs = 0) THEN
        DROP FUNCTION create_increment_referrals_function();
    END IF;
END $$;

-- Create the missing create_referral function that the referral system expects
-- This function is a wrapper around create_referral_safe for compatibility
CREATE OR REPLACE FUNCTION create_referral(
    p_referrer_id INTEGER,
    p_referred_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Call the safe referral creation function
    SELECT create_referral_safe(p_referrer_id, p_referred_id) INTO v_result;
    
    -- Return true if successful, false otherwise
    RETURN (v_result->>'success')::BOOLEAN;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        RAISE NOTICE 'Error in create_referral: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_referral(INTEGER, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_referral(INTEGER, INTEGER) IS 'Wrapper function for create_referral_safe - creates referral relationships';

-- Also create a function to process referral rewards that the referral system expects
CREATE OR REPLACE FUNCTION process_referral_rewards(
    p_referrers JSON,
    p_amount NUMERIC,
    p_config JSON
) RETURNS VOID AS $$
DECLARE
    v_referrer RECORD;
    v_reward NUMERIC;
    v_level INTEGER;
    v_rate NUMERIC;
BEGIN
    -- Loop through each referrer in the JSON array
    FOR v_referrer IN SELECT * FROM json_array_elements(p_referrers)
    LOOP
        v_level := (v_referrer->>'level')::INTEGER;
        v_rate := (p_config->>v_level::TEXT)::NUMERIC;
        
        -- Calculate reward
        v_reward := p_amount * v_rate;
        
        -- Insert referral earning
        INSERT INTO referral_earnings (
            user_id,
            referral_id,
            amount,
            level,
            status
        ) VALUES (
            (v_referrer->>'referrer_id')::INTEGER,
            (v_referrer->>'user_id')::INTEGER,
            v_reward,
            v_level,
            'completed'
        );
        
        -- Update user's total earned
        UPDATE users 
        SET total_earned = total_earned + v_reward
        WHERE id = (v_referrer->>'referrer_id')::INTEGER;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_referral_rewards(JSON, NUMERIC, JSON) TO authenticated;

-- Add comment
COMMENT ON FUNCTION process_referral_rewards(JSON, NUMERIC, JSON) IS 'Process referral rewards for multiple referrers';

-- Create function to increment team volume
CREATE OR REPLACE FUNCTION increment_team_volume(
    p_user_id INTEGER,
    p_increment_by NUMERIC
) RETURNS VOID AS $$
BEGIN
    -- Update user's team volume
    UPDATE users 
    SET team_volume = COALESCE(team_volume, 0) + p_increment_by
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_team_volume(INTEGER, NUMERIC) TO authenticated;

-- Add comment
COMMENT ON FUNCTION increment_team_volume(INTEGER, NUMERIC) IS 'Increment team volume for a user';

-- Create function to add STK balance
CREATE OR REPLACE FUNCTION add_stk_balance(
    p_user_id INTEGER,
    p_amount NUMERIC,
    p_type TEXT
) RETURNS VOID AS $$
BEGIN
    -- Update user's SBT balance (STK tokens)
    UPDATE users 
    SET total_sbt = COALESCE(total_sbt, 0) + p_amount
    WHERE id = p_user_id;
    
    -- Log the STK transaction
    INSERT INTO sbt_history (
        user_id,
        amount,
        type,
        timestamp
    ) VALUES (
        p_user_id,
        p_amount,
        p_type,
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_stk_balance(INTEGER, NUMERIC, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION add_stk_balance(INTEGER, NUMERIC, TEXT) IS 'Add STK balance to user and log transaction';

-- Create function to increment referrals count (for compatibility)
CREATE OR REPLACE FUNCTION create_increment_referrals_function()
RETURNS VOID AS $$
BEGIN
    -- This function is called by the frontend but doesn't need to do anything
    -- as the referral counting is handled by the create_referral function
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_increment_referrals_function() TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_increment_referrals_function() IS 'Compatibility function for referral system - no action needed';

-- Create referral_chain table for multi-level referral tracking
CREATE TABLE IF NOT EXISTS referral_chain (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    referrer_id INTEGER REFERENCES users(id) NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, referrer_id, level)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referral_chain_user_id ON referral_chain(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_chain_referrer_id ON referral_chain(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_chain_level ON referral_chain(level);

-- Add comment
COMMENT ON TABLE referral_chain IS 'Multi-level referral chain tracking table';

-- Verify all functions were created successfully
DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc 
    WHERE proname IN ('create_referral', 'process_referral_rewards', 'increment_team_volume', 'add_stk_balance', 'create_increment_referrals_function');
    
    RAISE NOTICE 'Successfully created % referral system functions', v_function_count;
END $$;











