-- Enhanced Duplicate Prevention for Referral System (Safe Version)
-- This script handles existing duplicates before adding constraints

-- 1. First, check for existing duplicates
DO $$
DECLARE
    v_duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT referrer_id, referred_id
        FROM referrals 
        GROUP BY referrer_id, referred_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF v_duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate referral relationships. Please run CLEANUP_DUPLICATE_REFERRALS.sql first.', v_duplicate_count;
        RAISE EXCEPTION 'Cannot proceed with duplicates present. Run cleanup script first.';
    ELSE
        RAISE NOTICE 'No duplicates found. Proceeding with constraint creation.';
    END IF;
END $$;

-- 2. Ensure unique constraint exists (only if no duplicates)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_referral_relationship'
    ) THEN
        ALTER TABLE referrals 
        ADD CONSTRAINT unique_referral_relationship 
        UNIQUE (referrer_id, referred_id);
        RAISE NOTICE 'Unique constraint added successfully';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- 3. Create a referral attempts tracking table for better analytics
CREATE TABLE IF NOT EXISTS referral_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    referral_code TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'invalid', 'duplicate', 'self_referral', 'already_has_referrer')),
    reason TEXT,
    referrer_username TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_referral_attempts_user_id ON referral_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_attempts_status ON referral_attempts(status);
CREATE INDEX IF NOT EXISTS idx_referral_attempts_timestamp ON referral_attempts(timestamp);

-- 4. Enhanced referral creation function with better duplicate prevention
CREATE OR REPLACE FUNCTION create_referral_enhanced(
    p_referrer_id INTEGER,
    p_referred_id INTEGER,
    p_referral_code TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_referral_id INTEGER;
    v_referrer_username TEXT;
    v_referred_username TEXT;
    v_attempt_id INTEGER;
BEGIN
    -- Log the attempt first
    INSERT INTO referral_attempts (
        user_id, 
        referral_code, 
        status, 
        reason, 
        referrer_username,
        ip_address,
        user_agent
    ) VALUES (
        p_referred_id,
        p_referral_code,
        'pending',
        'Processing referral attempt',
        NULL,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_attempt_id;

    -- Get usernames for logging
    SELECT username INTO v_referrer_username FROM users WHERE id = p_referrer_id;
    SELECT username INTO v_referred_username FROM users WHERE id = p_referred_id;

    -- Validate inputs
    IF p_referrer_id IS NULL OR p_referred_id IS NULL THEN
        UPDATE referral_attempts SET status = 'invalid', reason = 'Invalid input parameters' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid input parameters',
            'code', 'INVALID_INPUT',
            'attempt_id', v_attempt_id
        );
    END IF;

    -- Check for self-referral
    IF p_referrer_id = p_referred_id THEN
        UPDATE referral_attempts SET status = 'self_referral', reason = 'Cannot refer yourself' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'Cannot refer yourself',
            'code', 'SELF_REFERRAL',
            'attempt_id', v_attempt_id
        );
    END IF;

    -- Check if referred user already has a referrer
    IF EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_referred_id 
        AND referrer_id IS NOT NULL
    ) THEN
        UPDATE referral_attempts SET status = 'already_has_referrer', reason = 'User already has a referrer' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'User already has a referrer',
            'code', 'ALREADY_HAS_REFERRER',
            'attempt_id', v_attempt_id
        );
    END IF;

    -- Check if referral relationship already exists (double-check)
    IF EXISTS (
        SELECT 1 FROM referrals 
        WHERE referrer_id = p_referrer_id 
        AND referred_id = p_referred_id
    ) THEN
        UPDATE referral_attempts SET status = 'duplicate', reason = 'Referral relationship already exists' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'Referral relationship already exists',
            'code', 'DUPLICATE_REFERRAL',
            'attempt_id', v_attempt_id
        );
    END IF;

    -- Check for circular referral
    IF EXISTS (
        SELECT 1 FROM referrals 
        WHERE referrer_id = p_referred_id 
        AND referred_id = p_referrer_id
    ) THEN
        UPDATE referral_attempts SET status = 'invalid', reason = 'Circular referral not allowed' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'Circular referral not allowed',
            'code', 'CIRCULAR_REFERRAL',
            'attempt_id', v_attempt_id
        );
    END IF;

    -- Check if referrer exists
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_referrer_id
    ) THEN
        UPDATE referral_attempts SET status = 'failed', reason = 'Referrer not found' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'Referrer not found',
            'code', 'REFERRER_NOT_FOUND',
            'attempt_id', v_attempt_id
        );
    END IF;

    -- Check if referred user exists
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_referred_id
    ) THEN
        UPDATE referral_attempts SET status = 'failed', reason = 'User not found' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'User not found',
            'code', 'USER_NOT_FOUND',
            'attempt_id', v_attempt_id
        );
    END IF;

    -- Additional check: Prevent rapid duplicate attempts
    IF EXISTS (
        SELECT 1 FROM referral_attempts 
        WHERE user_id = p_referred_id 
        AND referral_code LIKE '%' || p_referrer_id::TEXT || '%'
        AND status IN ('success', 'duplicate', 'already_has_referrer')
        AND timestamp > NOW() - INTERVAL '1 hour'
    ) THEN
        UPDATE referral_attempts SET status = 'duplicate', reason = 'Recent duplicate attempt detected' WHERE id = v_attempt_id;
        RETURN json_build_object(
            'success', false,
            'error', 'Recent duplicate attempt detected',
            'code', 'RECENT_DUPLICATE',
            'attempt_id', v_attempt_id
        );
    END IF;

    BEGIN
        -- Create referral relationship
        INSERT INTO referrals (referrer_id, referred_id, status)
        VALUES (p_referrer_id, p_referred_id, 'active')
        RETURNING id INTO v_referral_id;

        -- Update user's referrer_id
        UPDATE users 
        SET referrer_id = p_referrer_id
        WHERE id = p_referred_id;

        -- Increment referrer's direct_referrals count
        UPDATE users 
        SET direct_referrals = COALESCE(direct_referrals, 0) + 1
        WHERE id = p_referrer_id;

        -- Log successful attempt
        UPDATE referral_attempts 
        SET status = 'success', 
            reason = 'Referral created successfully',
            referrer_username = v_referrer_username
        WHERE id = v_attempt_id;

        RETURN json_build_object(
            'success', true,
            'referral_id', v_referral_id,
            'message', 'Referral created successfully',
            'attempt_id', v_attempt_id,
            'referrer_username', v_referrer_username
        );

    EXCEPTION
        WHEN unique_violation THEN
            UPDATE referral_attempts SET status = 'duplicate', reason = 'Database constraint violation' WHERE id = v_attempt_id;
            RETURN json_build_object(
                'success', false,
                'error', 'Referral relationship already exists',
                'code', 'DUPLICATE_REFERRAL',
                'attempt_id', v_attempt_id
            );
        WHEN OTHERS THEN
            UPDATE referral_attempts SET status = 'failed', reason = 'Database error: ' || SQLERRM WHERE id = v_attempt_id;
            RETURN json_build_object(
                'success', false,
                'error', 'Database error: ' || SQLERRM,
                'code', 'DATABASE_ERROR',
                'attempt_id', v_attempt_id
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_referral_enhanced(INTEGER, INTEGER, TEXT, INET, TEXT) TO authenticated;

-- 5. Create a function to check referral status
CREATE OR REPLACE FUNCTION check_referral_status(
    p_referrer_id INTEGER,
    p_referred_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_referral_exists BOOLEAN;
    v_user_has_referrer BOOLEAN;
    v_referrer_username TEXT;
    v_referred_username TEXT;
BEGIN
    -- Check if referral relationship exists
    SELECT EXISTS(
        SELECT 1 FROM referrals 
        WHERE referrer_id = p_referrer_id 
        AND referred_id = p_referred_id
    ) INTO v_referral_exists;

    -- Check if user already has a referrer
    SELECT EXISTS(
        SELECT 1 FROM users 
        WHERE id = p_referred_id 
        AND referrer_id IS NOT NULL
    ) INTO v_user_has_referrer;

    -- Get usernames
    SELECT username INTO v_referrer_username FROM users WHERE id = p_referrer_id;
    SELECT username INTO v_referred_username FROM users WHERE id = p_referred_id;

    RETURN json_build_object(
        'referral_exists', v_referral_exists,
        'user_has_referrer', v_user_has_referrer,
        'referrer_username', v_referrer_username,
        'referred_username', v_referred_username,
        'can_refer', NOT v_referral_exists AND NOT v_user_has_referrer AND p_referrer_id != p_referred_id
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_referral_status(INTEGER, INTEGER) TO authenticated;

-- 6. Create a function to get referral analytics
CREATE OR REPLACE FUNCTION get_referral_analytics(
    p_user_id INTEGER DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_total_attempts INTEGER;
    v_successful_referrals INTEGER;
    v_failed_attempts INTEGER;
    v_duplicate_attempts INTEGER;
    v_conversion_rate NUMERIC;
BEGIN
    -- Get analytics
    SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE status = 'success') as successful_referrals,
        COUNT(*) FILTER (WHERE status IN ('failed', 'invalid')) as failed_attempts,
        COUNT(*) FILTER (WHERE status = 'duplicate') as duplicate_attempts
    INTO v_total_attempts, v_successful_referrals, v_failed_attempts, v_duplicate_attempts
    FROM referral_attempts
    WHERE (p_user_id IS NULL OR user_id = p_user_id);

    -- Calculate conversion rate
    v_conversion_rate := CASE 
        WHEN v_total_attempts > 0 THEN (v_successful_referrals::NUMERIC / v_total_attempts) * 100
        ELSE 0
    END;

    RETURN json_build_object(
        'total_attempts', v_total_attempts,
        'successful_referrals', v_successful_referrals,
        'failed_attempts', v_failed_attempts,
        'duplicate_attempts', v_duplicate_attempts,
        'conversion_rate', v_conversion_rate
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_referral_analytics(INTEGER) TO authenticated;

-- 7. Add comments
COMMENT ON FUNCTION create_referral_enhanced(INTEGER, INTEGER, TEXT, INET, TEXT) IS 'Enhanced referral creation with comprehensive duplicate prevention and tracking';
COMMENT ON FUNCTION check_referral_status(INTEGER, INTEGER) IS 'Check if a referral relationship can be created';
COMMENT ON FUNCTION get_referral_analytics(INTEGER) IS 'Get referral system analytics and conversion rates';
COMMENT ON TABLE referral_attempts IS 'Track all referral attempts for analytics and duplicate prevention';

-- 8. Create a view for easy referral monitoring
CREATE OR REPLACE VIEW referral_monitoring AS
SELECT 
    ra.id,
    ra.user_id,
    ra.referral_code,
    ra.status,
    ra.reason,
    ra.referrer_username,
    ra.timestamp,
    ra.ip_address,
    u.username as referred_username,
    u.referrer_id
FROM referral_attempts ra
LEFT JOIN users u ON ra.user_id = u.id
ORDER BY ra.timestamp DESC;

-- Grant select permission
GRANT SELECT ON referral_monitoring TO authenticated;

-- 9. Final verification
DO $$
DECLARE
    v_duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT referrer_id, referred_id
        FROM referrals 
        GROUP BY referrer_id, referred_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF v_duplicate_count = 0 THEN
        RAISE NOTICE '✅ Enhanced duplicate prevention system installed successfully!';
        RAISE NOTICE '✅ No duplicate referrals found in database';
        RAISE NOTICE '✅ Unique constraint is active';
        RAISE NOTICE '✅ All functions and tables created successfully';
    ELSE
        RAISE NOTICE '⚠️  Warning: % duplicate referrals still exist. Consider running cleanup script.', v_duplicate_count;
    END IF;
END $$;
