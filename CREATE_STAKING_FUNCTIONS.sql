-- Create staking functions for Divine Mining platform

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

-- Function to claim rewards from a stake
CREATE OR REPLACE FUNCTION claim_stake_rewards(
    p_stake_id INTEGER,
    p_user_id INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    v_stake stakes%ROWTYPE;
    v_user users%ROWTYPE;
    v_reward NUMERIC;
    v_net_reward NUMERIC;
    v_max_earnings NUMERIC;
BEGIN
    -- Get stake details
    SELECT * INTO v_stake FROM stakes WHERE id = p_stake_id AND user_id = p_user_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stake not found or inactive: %', p_stake_id;
    END IF;

    -- Get user details
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Calculate reward
    v_reward := calculate_stake_reward_amount(p_stake_id);
    
    IF v_reward <= 0 THEN
        RETURN 0;
    END IF;

    -- Check max earnings (300% of stake amount)
    v_max_earnings := v_stake.amount * 3;
    IF (v_stake.total_earned + v_reward) > v_max_earnings THEN
        v_reward := GREATEST(0, v_max_earnings - v_stake.total_earned);
    END IF;

    -- Calculate net reward (60% to user, 40% platform fee)
    v_net_reward := v_reward * 0.6;

    -- Update stake
    UPDATE stakes 
    SET 
        total_earned = total_earned + v_reward,
        last_payout = NOW(),
        cycle_progress = CASE 
            WHEN (total_earned + v_reward) >= (amount * 3) THEN 100
            ELSE ((total_earned + v_reward) / (amount * 3)) * 100
        END
    WHERE id = p_stake_id;

    -- Update user balance
    UPDATE users 
    SET 
        balance = balance + v_net_reward,
        total_earned = total_earned + v_reward,
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
        'rewards_claimed', 
        v_net_reward, 
        'Claimed rewards from stake #' || p_stake_id, 
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
        'stake_rewards',
        v_net_reward,
        jsonb_build_object(
            'stake_id', p_stake_id,
            'total_reward', v_reward,
            'platform_fee', v_reward * 0.4,
            'net_reward', v_net_reward
        ),
        NOW()
    );

    RETURN v_net_reward;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate reward amount for a stake
CREATE OR REPLACE FUNCTION calculate_stake_reward_amount(p_stake_id INTEGER)
RETURNS NUMERIC AS $$
DECLARE
    v_stake stakes%ROWTYPE;
    v_hours_since_last_payout NUMERIC;
    v_daily_reward NUMERIC;
    v_reward NUMERIC;
BEGIN
    -- Get stake details
    SELECT * INTO v_stake FROM stakes WHERE id = p_stake_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Calculate hours since last payout
    v_hours_since_last_payout := EXTRACT(EPOCH FROM (NOW() - v_stake.last_payout)) / 3600;
    
    -- Calculate daily reward
    v_daily_reward := v_stake.amount * v_stake.daily_rate;
    
    -- Calculate reward based on hours passed
    v_reward := (v_daily_reward / 24) * v_hours_since_last_payout;
    
    -- Apply speed boost multiplier if active
    IF v_stake.speed_boost_active THEN
        v_reward := v_reward * 2;
    END IF;

    RETURN GREATEST(0, v_reward);
END;
$$ LANGUAGE plpgsql;

-- Function to activate speed boost
CREATE OR REPLACE FUNCTION activate_speed_boost(
    p_stake_id INTEGER,
    p_user_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_stake stakes%ROWTYPE;
BEGIN
    -- Get stake details
    SELECT * INTO v_stake FROM stakes WHERE id = p_stake_id AND user_id = p_user_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stake not found or inactive: %', p_stake_id;
    END IF;

    -- Check if speed boost is already active
    IF v_stake.speed_boost_active THEN
        RAISE EXCEPTION 'Speed boost is already active for stake: %', p_stake_id;
    END IF;

    -- Activate speed boost
    UPDATE stakes 
    SET speed_boost_active = true
    WHERE id = p_stake_id;

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
        'speed_boost_activated', 
        0, 
        'Activated speed boost for stake #' || p_stake_id, 
        'completed',
        NOW()
    );

    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
        RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to get user stakes with calculated rewards
CREATE OR REPLACE FUNCTION get_user_stakes_with_rewards(p_user_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    amount NUMERIC,
    daily_rate NUMERIC,
    total_earned NUMERIC,
    start_date TIMESTAMP WITH TIME ZONE,
    last_payout TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN,
    speed_boost_active BOOLEAN,
    cycle_progress NUMERIC,
    available_rewards NUMERIC,
    tier_name VARCHAR(100),
    days_active INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.amount,
        s.daily_rate,
        s.total_earned,
        s.start_date,
        s.last_payout,
        s.is_active,
        s.speed_boost_active,
        s.cycle_progress,
        calculate_stake_reward_amount(s.id) as available_rewards,
        CASE 
            WHEN s.amount >= 5000 THEN 'Diamond'
            WHEN s.amount >= 1000 THEN 'Platinum'
            WHEN s.amount >= 200 THEN 'Gold'
            WHEN s.amount >= 50 THEN 'Silver'
            ELSE 'Bronze'
        END as tier_name,
        EXTRACT(DAY FROM (NOW() - s.start_date))::INTEGER as days_active
    FROM stakes s
    WHERE s.user_id = p_user_id
    ORDER BY s.start_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get user staking statistics
CREATE OR REPLACE FUNCTION get_user_staking_stats(p_user_id INTEGER)
RETURNS TABLE (
    total_stakes INTEGER,
    active_stakes INTEGER,
    total_staked NUMERIC,
    total_earned NUMERIC,
    available_rewards NUMERIC,
    average_daily_rate NUMERIC,
    total_days_staking INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_stakes,
        COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_stakes,
        COALESCE(SUM(amount), 0) as total_staked,
        COALESCE(SUM(total_earned), 0) as total_earned,
        COALESCE(SUM(calculate_stake_reward_amount(id)), 0) as available_rewards,
        COALESCE(AVG(daily_rate), 0) as average_daily_rate,
        COALESCE(EXTRACT(DAY FROM (MAX(NOW()) - MIN(start_date)))::INTEGER, 0) as total_days_staking
    FROM stakes
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_stake(INTEGER, NUMERIC, NUMERIC, VARCHAR(100)) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_stake_rewards(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_stake_reward_amount(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_speed_boost(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stakes_with_rewards(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_staking_stats(INTEGER) TO authenticated;

-- Add comments
COMMENT ON FUNCTION create_stake(INTEGER, NUMERIC, NUMERIC, VARCHAR(100)) IS 'Create a new stake for a user';
COMMENT ON FUNCTION claim_stake_rewards(INTEGER, INTEGER) IS 'Claim rewards from a stake';
COMMENT ON FUNCTION calculate_stake_reward_amount(INTEGER) IS 'Calculate available rewards for a stake';
COMMENT ON FUNCTION activate_speed_boost(INTEGER, INTEGER) IS 'Activate speed boost for a stake';
COMMENT ON FUNCTION get_user_stakes_with_rewards(INTEGER) IS 'Get all stakes for a user with calculated rewards';
COMMENT ON FUNCTION get_user_staking_stats(INTEGER) IS 'Get staking statistics for a user'; 