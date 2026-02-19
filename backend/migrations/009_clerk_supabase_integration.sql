-- Migration 009: Clerk + Supabase Integration
-- Changes user_id columns from UUID to TEXT for Clerk user IDs
-- Updates RLS policies to use auth.jwt()->>'sub' instead of auth.uid()
--
-- NOTE: This migration was applied directly via Supabase MCP on 2025-12-22
-- It is documented here for reproducibility.

-- ============================================================================
-- STEP 1: Drop existing foreign key constraints
-- ============================================================================

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
ALTER TABLE ocr_results DROP CONSTRAINT IF EXISTS ocr_results_user_id_fkey;
ALTER TABLE extractions DROP CONSTRAINT IF EXISTS extractions_user_id_fkey;
ALTER TABLE stacks DROP CONSTRAINT IF EXISTS stacks_user_id_fkey;
ALTER TABLE stack_tables DROP CONSTRAINT IF EXISTS stack_tables_user_id_fkey;
ALTER TABLE stack_table_rows DROP CONSTRAINT IF EXISTS stack_table_rows_user_id_fkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- ============================================================================
-- STEP 2: Drop old RLS policies (auth.uid() based)
-- ============================================================================

DROP POLICY IF EXISTS users_user_isolation ON public.users;
DROP POLICY IF EXISTS documents_user_isolation ON documents;
DROP POLICY IF EXISTS ocr_results_user_isolation ON ocr_results;
DROP POLICY IF EXISTS extractions_user_isolation ON extractions;
DROP POLICY IF EXISTS stacks_user_isolation ON stacks;
DROP POLICY IF EXISTS stack_documents_user_isolation ON stack_documents;
DROP POLICY IF EXISTS stack_tables_user_isolation ON stack_tables;
DROP POLICY IF EXISTS stack_table_rows_user_isolation ON stack_table_rows;

-- ============================================================================
-- STEP 3: Change column types from UUID to TEXT
-- ============================================================================

-- public.users.id is the Clerk user ID (primary key)
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;

-- All user_id foreign key columns
ALTER TABLE documents ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE ocr_results ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE extractions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE stacks ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE stack_tables ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE stack_table_rows ALTER COLUMN user_id TYPE TEXT;

-- ============================================================================
-- STEP 4: Set defaults to auto-populate from Clerk JWT
-- ============================================================================

ALTER TABLE public.users ALTER COLUMN id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE documents ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE ocr_results ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE extractions ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE stacks ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE stack_tables ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE stack_table_rows ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';

-- ============================================================================
-- STEP 5: Create new RLS policies using Clerk JWT (auth.jwt()->>'sub')
-- ============================================================================

-- Users table: id IS the user_id
CREATE POLICY "users_clerk_isolation" ON public.users
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = id);

-- Documents table
CREATE POLICY "documents_clerk_isolation" ON documents
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- OCR Results table
CREATE POLICY "ocr_results_clerk_isolation" ON ocr_results
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Extractions table
CREATE POLICY "extractions_clerk_isolation" ON extractions
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Stacks table
CREATE POLICY "stacks_clerk_isolation" ON stacks
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Stack Documents table (junction table - access via stack ownership)
CREATE POLICY "stack_documents_clerk_isolation" ON stack_documents
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM stacks
    WHERE stacks.id = stack_documents.stack_id
    AND stacks.user_id = (SELECT auth.jwt()->>'sub')
));

-- Stack Tables table
CREATE POLICY "stack_tables_clerk_isolation" ON stack_tables
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Stack Table Rows table
CREATE POLICY "stack_table_rows_clerk_isolation" ON stack_table_rows
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);
