-- =============================================
-- WALLET ADDRESS MIGRATION - FIX NOT NULL CONSTRAINT
-- =============================================
-- This script fixes the wallet_address column to allow NULL values
-- This resolves the authentication error when creating new users

DO $$
BEGIN
    -- Check if wallet_address column has NOT NULL constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'wallet_address' 
        AND is_nullable = 'NO'
    ) THEN
        -- Remove NOT NULL constraint from wallet_address column
        ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
        RAISE NOTICE '✅ Removed NOT NULL constraint from wallet_address column';
    ELSE
        RAISE NOTICE '⚠️  wallet_address column is already nullable or does not exist';
    END IF;
    
    -- Ensure the column exists and has the right type
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'wallet_address'
    ) THEN
        ALTER TABLE users ADD COLUMN wallet_address VARCHAR(255);
        RAISE NOTICE '✅ Added wallet_address column to users table';
    END IF;
    
    -- Ensure UNIQUE constraint exists (but allow NULL)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'users' 
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name = 'wallet_address'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_wallet_address_key UNIQUE (wallet_address);
        RAISE NOTICE '✅ Added UNIQUE constraint to wallet_address column';
    ELSE
        RAISE NOTICE '⚠️  UNIQUE constraint already exists on wallet_address column';
    END IF;

END $$;

-- Verify the changes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'wallet_address';

RAISE NOTICE '✅ Wallet address migration completed successfully';
RAISE NOTICE '📝 Users can now be created without a wallet address (will be NULL until they connect their wallet)'; 