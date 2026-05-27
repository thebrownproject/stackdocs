-- Migration 006: Add status column to extractions
-- Enables agent workflow: pending → in_progress → completed/failed

ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';

-- Set existing records to 'completed' (they were successful extractions)
UPDATE extractions SET status = 'completed' WHERE status IS NULL;

-- Add check constraint
ALTER TABLE extractions
ADD CONSTRAINT extractions_status_check
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'));

COMMENT ON COLUMN extractions.status IS 'Extraction status: pending, in_progress, completed, failed';
