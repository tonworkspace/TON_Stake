# Fix for cycle_progress Column Error

## Issue Description

The stealth saving system was failing with the error:
```
Stakes stealth save failed, queuing for retry: {code: 'PGRST204', details: null, hint: null, message: "Could not find the 'cycle_progress' column of 'stakes' in the schema cache"}
```

This occurred because the `cycle_progress` column was missing from the `stakes` table in the database, but the code was trying to update it.

## Root Cause

The `stakes` table in the current database schema doesn't include the `cycle_progress` column, but:
1. The stealth saving system expects this column to exist
2. The SQL functions in `CREATE_STAKING_FUNCTIONS.sql` reference this column
3. The `UserStake` interface includes this field

## Solution

### Step 1: Run the Migration Script

Execute the migration script to add the missing column:

```sql
-- Run this in your Supabase SQL editor
\i ADD_CYCLE_PROGRESS_COLUMN.sql
```

Or manually run:

```sql
-- Add cycle_progress column to stakes table
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
```

### Step 2: Verify the Column Was Added

Check that the column was successfully added:

```sql
-- Verify the column exists (Supabase compatible)
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
```

### Step 3: Test the Stealth Saving System

After adding the column, the stealth saving system should work properly. You can verify by:

1. Creating a new stake
2. Checking the browser console for stealth save messages
3. Verifying data is being saved to Supabase

## What the cycle_progress Column Does

The `cycle_progress` column tracks the progress of each stake through its earning cycle:

- **0-100**: Percentage of progress toward the 300% return goal
- **0**: Just started (0% earned)
- **100**: Completed cycle (300% earned)
- **Formula**: `(total_earned / (amount * 3)) * 100`

## Alternative Solutions (if you can't modify the database)

If you cannot modify the database schema, you can:

### Option 1: Remove cycle_progress from stealth saving
```typescript
// In processStakeUpdate function, comment out cycle_progress
const { error } = await supabase
  .from('stakes')
  .update({
    total_earned: data.totalEarned,
    last_payout: data.lastPayout,
    speed_boost_active: data.speedBoostActive
    // cycle_progress: data.cycleProgress // Comment this out
  })
  .eq('id', data.stakeId);
```

### Option 2: Store cycle_progress in user_game_data table
```typescript
// Store cycle_progress in the game_data JSON field
const { error } = await supabase
  .from('user_game_data')
  .upsert({
    user_id: data.userId,
    game_data: {
      stakes: {
        [data.stakeId]: {
          cycle_progress: data.cycleProgress
        }
      }
    },
    last_updated: new Date().toISOString()
  }, {
    onConflict: 'user_id'
  });
```

## Prevention

To prevent similar issues in the future:

1. **Schema Versioning**: Keep database schema files up to date
2. **Migration Scripts**: Always create migration scripts for schema changes
3. **Testing**: Test stealth saving with a fresh database
4. **Documentation**: Document all required database columns

## Verification

After applying the fix, you should see:

1. ✅ No more `cycle_progress` column errors
2. ✅ Stealth saving working properly
3. ✅ Data being synced to Supabase
4. ✅ Offline queue processing successfully

## Related Files

- `ADD_CYCLE_PROGRESS_COLUMN.sql` - Migration script
- `src/components/DailyRewards.tsx` - Stealth saving implementation
- `CREATE_STAKING_FUNCTIONS.sql` - Database functions
- `schema.sql` - Database schema 