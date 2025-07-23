-- Add cycle_progress column to stakes table
-- This migration adds the missing cycle_progress column that is used by the stealth saving system

-- Check if the column already exists before adding it
DO $$ 
BEGIN
    -- Add cycle_progress column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stakes' AND column_name = 'cycle_progress'
    ) THEN
        ALTER TABLE stakes ADD COLUMN cycle_progress NUMERIC DEFAULT 0;
        
        -- Update existing stakes to have a calculated cycle_progress
        UPDATE stakes 
        SET cycle_progress = CASE 
            WHEN total_earned >= (amount * 3) THEN 100
            ELSE (total_earned / (amount * 3)) * 100
        END
        WHERE cycle_progress IS NULL OR cycle_progress = 0;
        
        RAISE NOTICE 'Added cycle_progress column to stakes table and updated existing records';
    ELSE
        RAISE NOTICE 'cycle_progress column already exists in stakes table';
    END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN stakes.cycle_progress IS 'Progress percentage of the stake cycle (0-100, where 100 = 300% return achieved)';

-- Verify the column was added successfully
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    CASE 
        WHEN column_name = 'cycle_progress' THEN '✅ Column added successfully'
        ELSE 'Column already exists'
    END as status
FROM information_schema.columns 
WHERE table_name = 'stakes' AND column_name = 'cycle_progress'; 