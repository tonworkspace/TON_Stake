-- Safely alter deposits table to add missing columns
-- This preserves existing data

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add transaction_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'transaction_hash'
    ) THEN
        ALTER TABLE deposits ADD COLUMN transaction_hash TEXT;
    END IF;

    -- Add processed_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deposits' AND column_name = 'processed_at'
    ) THEN
        ALTER TABLE deposits ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add constraints if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'deposits' AND constraint_name = 'valid_status'
    ) THEN
        ALTER TABLE deposits ADD CONSTRAINT valid_status 
        CHECK (status IN ('pending', 'completed', 'failed'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'deposits' AND constraint_name = 'positive_amount'
    ) THEN
        ALTER TABLE deposits ADD CONSTRAINT positive_amount 
        CHECK (amount > 0);
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- Show final table structure
\d deposits; 