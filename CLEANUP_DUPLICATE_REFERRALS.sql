-- Cleanup Duplicate Referrals Before Adding Unique Constraint
-- This script removes duplicate referral relationships safely

-- 1. First, let's see what duplicates exist
SELECT 
    referrer_id, 
    referred_id, 
    COUNT(*) as duplicate_count,
    MIN(id) as keep_id,
    ARRAY_AGG(id) as all_ids
FROM referrals 
GROUP BY referrer_id, referred_id 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Create a backup of the referrals table
CREATE TABLE IF NOT EXISTS referrals_backup AS 
SELECT * FROM referrals;

-- 3. Create a table to track what we're cleaning up
CREATE TABLE IF NOT EXISTS referral_cleanup_log (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    referrer_id INTEGER,
    referred_id INTEGER,
    removed_count INTEGER,
    kept_id INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Function to safely remove duplicates
CREATE OR REPLACE FUNCTION cleanup_duplicate_referrals()
RETURNS JSON AS $$
DECLARE
    v_duplicate_record RECORD;
    v_removed_count INTEGER := 0;
    v_total_duplicates INTEGER := 0;
BEGIN
    -- Count total duplicates first
    SELECT COUNT(*) INTO v_total_duplicates
    FROM (
        SELECT referrer_id, referred_id
        FROM referrals 
        GROUP BY referrer_id, referred_id 
        HAVING COUNT(*) > 1
    ) duplicates;

    -- Process each duplicate group
    FOR v_duplicate_record IN 
        SELECT 
            referrer_id, 
            referred_id, 
            COUNT(*) as duplicate_count,
            MIN(id) as keep_id,
            ARRAY_AGG(id) as all_ids
        FROM referrals 
        GROUP BY referrer_id, referred_id 
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC
    LOOP
        -- Remove all duplicates except the one with the lowest ID (oldest)
        DELETE FROM referrals 
        WHERE referrer_id = v_duplicate_record.referrer_id 
        AND referred_id = v_duplicate_record.referred_id
        AND id != v_duplicate_record.keep_id;
        
        -- Log the cleanup
        INSERT INTO referral_cleanup_log (
            action, 
            referrer_id, 
            referred_id, 
            removed_count, 
            kept_id
        ) VALUES (
            'removed_duplicates',
            v_duplicate_record.referrer_id,
            v_duplicate_record.referred_id,
            v_duplicate_record.duplicate_count - 1,
            v_duplicate_record.keep_id
        );
        
        v_removed_count := v_removed_count + (v_duplicate_record.duplicate_count - 1);
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'total_duplicates_found', v_total_duplicates,
        'duplicates_removed', v_removed_count,
        'message', 'Duplicate referrals cleaned up successfully'
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Run the cleanup
SELECT cleanup_duplicate_referrals();

-- 6. Verify no duplicates remain
SELECT 
    'Verification: Remaining duplicates' as check_type,
    COUNT(*) as duplicate_count
FROM (
    SELECT referrer_id, referred_id
    FROM referrals 
    GROUP BY referrer_id, referred_id 
    HAVING COUNT(*) > 1
) remaining_duplicates;

-- 7. Now we can safely add the unique constraint
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

-- 8. Show cleanup summary
SELECT 
    'Cleanup Summary' as summary_type,
    COUNT(*) as total_cleanup_actions,
    SUM(removed_count) as total_duplicates_removed
FROM referral_cleanup_log 
WHERE action = 'removed_duplicates';

-- 9. Show final referral count
SELECT 
    'Final Count' as count_type,
    COUNT(*) as total_referrals
FROM referrals;











