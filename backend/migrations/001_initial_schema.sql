-- Stackdocs MVP Initial Schema
-- Migration: 001
-- Created: 2025-11-03
-- Description: Create core tables (users, documents, extractions) with RLS policies

-- ============================================================================
-- 1. Users Table (with usage tracking)
-- ============================================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,

    -- Usage tracking (current month only)
    documents_processed_this_month INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),

    -- Subscription
    subscription_tier VARCHAR(20) DEFAULT 'free',
    documents_limit INTEGER DEFAULT 5,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_reset_date ON public.users(usage_reset_date);

-- ============================================================================
-- 2. Documents Table
-- ============================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'processing',
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_user_id ON documents(user_id, uploaded_at DESC);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_user_status ON documents(user_id, status);

-- ============================================================================
-- 3. Extractions Table
-- ============================================================================
CREATE TABLE extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    extracted_fields JSONB NOT NULL,
    confidence_scores JSONB,
    mode VARCHAR(20) NOT NULL,
    custom_fields TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extractions_document_id ON extractions(document_id, created_at DESC);
CREATE INDEX idx_extractions_user_id ON extractions(user_id, created_at DESC);
CREATE INDEX idx_extractions_fields ON extractions USING GIN (extracted_fields);

-- ============================================================================
-- 4. Enable Row-Level Security
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS Policies (User Isolation)
-- ============================================================================
CREATE POLICY users_user_isolation ON public.users
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY documents_user_isolation ON documents
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY extractions_user_isolation ON extractions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. Auto-create User Profile for New Auth Users (Trigger Function)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_public_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_public_user();
