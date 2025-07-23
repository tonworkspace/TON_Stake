-- SAFE REFERRAL CLEANUP AND MIGRATION
-- This script safely handles existing duplicate data before applying constraints

-- Step 1: Backup existing referrals table
CREATE TABLE referrals_backup AS SELECT * FROM referrals;
COMMENT ON TABLE referrals_backup IS 'Backup of referrals table before cleanup migration';

-- Step 2: Identify and analyze duplicate referral relationships
-- Show duplicate entries for review
SELECT 
    referrer_id, 
    referred_id, 
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY created_at DESC) as referral_ids,
    array_agg(created_at ORDER BY created_at DESC) as created_dates
FROM referrals
GROUP BY referrer_id, referred_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, referrer_id, referred_id;

-- Step 3: Create a temporary table with deduplicated referrals
-- Keep the oldest referral for each unique (referrer_id, referred_id) pair
CREATE TEMP TABLE deduplicated_referrals AS
WITH ranked_referrals AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            PARTITION BY referrer_id, referred_id 
            ORDER BY created_at ASC  -- Keep the oldest one
        ) as rn
    FROM referrals
)
SELECT * 
FROM ranked_referrals 
WHERE rn = 1;

-- Step 4: Log the duplicates that will be removed for audit purposes
CREATE TABLE IF NOT EXISTS referral_cleanup_log (
    id SERIAL PRIMARY KEY,
    cleanup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action VARCHAR(50),
    referrer_id INTEGER,
    referred_id INTEGER,
    removed_referral_id INTEGER,
    removed_created_at TIMESTAMP WITH TIME ZONE,
    reason TEXT
);

-- Insert records of duplicates being removed
INSERT INTO referral_cleanup_log (
    action, referrer_id, referred_id, removed_referral_id, 
    removed_created_at, reason
)
SELECT 
    'DUPLICATE_REMOVED' as action,
    r.referrer_id,
    r.referred_id,
    r.id as removed_referral_id,
    r.created_at as removed_created_at,
    'Duplicate referral relationship - kept oldest entry' as reason
FROM referrals r
WHERE NOT EXISTS (
    SELECT 1 FROM deduplicated_referrals d 
    WHERE d.id = r.id
);

-- Step 5: Replace the referrals table with deduplicated data
BEGIN;

-- Remove all existing referrals
DELETE FROM referrals;

-- Insert deduplicated referrals
INSERT INTO referrals 
SELECT id, referrer_id, referred_id, created_at
FROM deduplicated_referrals
ORDER BY id;

-- Verify no duplicates remain
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT referrer_id, referred_id, COUNT(*) 
        FROM referrals 
        GROUP BY referrer_id, referred_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Still have % duplicate referral relationships after cleanup!', duplicate_count;
    ELSE
        RAISE NOTICE 'Successfully cleaned up all duplicate referral relationships';
    END IF;
END $$;

COMMIT;

-- Step 6: Now safely add the unique constraint
ALTER TABLE referrals 
ADD CONSTRAINT unique_referral_relationship 
UNIQUE (referrer_id, referred_id);

-- Step 7: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_referred ON referrals(referrer_id, referred_id);

-- Step 8: Add status column for better tracking (optional)
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'inactive', 'pending'));

-- Step 9: Update users table to ensure consistency
-- Fix any inconsistencies between users.referrer_id and referrals table
UPDATE users 
SET referrer_id = NULL
WHERE referrer_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM referrals 
    WHERE referred_id = users.id 
    AND referrer_id = users.referrer_id
);

-- Step 10: Update direct_referrals counts to ensure accuracy
UPDATE users 
SET direct_referrals = (
    SELECT COUNT(*) 
    FROM referrals 
    WHERE referrer_id = users.id
)
WHERE id IN (
    SELECT DISTINCT referrer_id 
    FROM referrals 
    WHERE referrer_id IS NOT NULL
);

-- Step 11: Create the safe referral creation function
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

-- Step 12: Add comments for documentation
COMMENT ON CONSTRAINT unique_referral_relationship ON referrals IS 'Prevents duplicate referral relationships between the same users';
COMMENT ON FUNCTION create_referral_safe IS 'Safely creates referral relationships with comprehensive duplicate prevention and validation';
COMMENT ON TABLE referral_cleanup_log IS 'Audit log of referral cleanup operations';

-- Step 13: Final verification and summary
DO $$
DECLARE
    total_referrals INTEGER;
    total_duplicates_removed INTEGER;
    total_users_with_referrers INTEGER;
BEGIN
    -- Count current referrals
    SELECT COUNT(*) INTO total_referrals FROM referrals;
    
    -- Count duplicates removed
    SELECT COUNT(*) INTO total_duplicates_removed 
    FROM referral_cleanup_log 
    WHERE action = 'DUPLICATE_REMOVED';
    
    -- Count users with referrers
    SELECT COUNT(*) INTO total_users_with_referrers 
    FROM users 
    WHERE referrer_id IS NOT NULL;
    
    RAISE NOTICE '=== REFERRAL CLEANUP MIGRATION COMPLETE ===';
    RAISE NOTICE 'Total referrals remaining: %', total_referrals;
    RAISE NOTICE 'Total duplicates removed: %', total_duplicates_removed;
    RAISE NOTICE 'Users with referrers: %', total_users_with_referrers;
    RAISE NOTICE 'Unique constraint added successfully';
    RAISE NOTICE 'Backup table created: referrals_backup';
    RAISE NOTICE 'Cleanup log available: referral_cleanup_log';
END $$;

-- Optional: View the cleanup summary
SELECT 
    'MIGRATION_SUMMARY' as report_type,
    COUNT(*) as total_referrals_remaining,
    (SELECT COUNT(*) FROM referral_cleanup_log WHERE action = 'DUPLICATE_REMOVED') as duplicates_removed,
    (SELECT COUNT(*) FROM users WHERE referrer_id IS NOT NULL) as users_with_referrers
FROM referrals; 