-- Migration: Add unique constraint to prevent duplicate referral relationships
-- This ensures database-level integrity for referral relationships

-- Add unique constraint to referrals table
-- This prevents duplicate referral relationships between the same referrer and referred user
ALTER TABLE referrals 
ADD CONSTRAINT unique_referral_relationship 
UNIQUE (referrer_id, referred_id);

-- Add index on referrer_id for better query performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

-- Add index on referred_id for better query performance  
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);

-- Add composite index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_referred ON referrals(referrer_id, referred_id);

-- Add status column to referrals table for better tracking (optional)
-- This allows marking referrals as active/inactive without deleting records
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'inactive', 'pending'));

-- Add created_at if it doesn't exist (from schema it should exist)
-- ALTER TABLE referrals 
-- ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to safely handle referral creation with duplicate prevention
CREATE OR REPLACE FUNCTION create_referral_safe(
    p_referrer_id INTEGER,
    p_referred_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_referral_id INTEGER;
BEGIN
    -- Validate inputs
    IF p_referrer_id IS NULL OR p_referred_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid input parameters',
            'code', 'INVALID_INPUT'
        );
    END IF;

    -- Check for self-referral
    IF p_referrer_id = p_referred_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cannot refer yourself',
            'code', 'SELF_REFERRAL'
        );
    END IF;

    -- Check if referred user already has a referrer
    IF EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_referred_id 
        AND referrer_id IS NOT NULL
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User already has a referrer',
            'code', 'ALREADY_HAS_REFERRER'
        );
    END IF;

    -- Check if referral relationship already exists
    IF EXISTS (
        SELECT 1 FROM referrals 
        WHERE referrer_id = p_referrer_id 
        AND referred_id = p_referred_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Referral relationship already exists',
            'code', 'DUPLICATE_REFERRAL'
        );
    END IF;

    -- Check for circular referral
    IF EXISTS (
        SELECT 1 FROM referrals 
        WHERE referrer_id = p_referred_id 
        AND referred_id = p_referrer_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Circular referral not allowed',
            'code', 'CIRCULAR_REFERRAL'
        );
    END IF;

    -- Check if referrer exists
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_referrer_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Referrer not found',
            'code', 'REFERRER_NOT_FOUND'
        );
    END IF;

    -- Check if referred user exists
    IF NOT EXISTS (
        SELECT 1 FROM users WHERE id = p_referred_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found',
            'code', 'USER_NOT_FOUND'
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

        RETURN json_build_object(
            'success', true,
            'referral_id', v_referral_id,
            'message', 'Referral created successfully'
        );

    EXCEPTION
        WHEN unique_violation THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Referral relationship already exists',
                'code', 'DUPLICATE_REFERRAL'
            );
        WHEN OTHERS THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Database error: ' || SQLERRM,
                'code', 'DATABASE_ERROR'
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the function
-- GRANT EXECUTE ON FUNCTION create_referral_safe TO your_app_user;

COMMENT ON FUNCTION create_referral_safe IS 'Safely creates referral relationships with comprehensive duplicate prevention and validation';
COMMENT ON CONSTRAINT unique_referral_relationship ON referrals IS 'Prevents duplicate referral relationships between the same users'; 