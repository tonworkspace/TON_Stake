-- Drop and recreate deposits table to fix schema issues
-- WARNING: This will delete all existing deposit data

-- Drop the existing deposits table
DROP TABLE IF EXISTS deposits CASCADE;

-- Recreate deposits table with correct structure
CREATE TABLE deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed')),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Recreate indexes
CREATE INDEX idx_deposits_user_id ON deposits(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);

-- Add comment
COMMENT ON TABLE deposits IS 'User deposit transactions for the Divine Mining platform'; 