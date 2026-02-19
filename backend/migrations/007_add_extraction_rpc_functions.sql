-- Migration 007: RPC functions for extraction field updates
-- Used by agent tools for surgical JSONB updates

-- Function: Update a field at a JSON path
CREATE OR REPLACE FUNCTION update_extraction_field(
    p_extraction_id UUID,
    p_user_id TEXT,
    p_field_path TEXT[],
    p_value JSONB,
    p_confidence FLOAT
) RETURNS VOID AS $$
BEGIN
    UPDATE extractions
    SET
        extracted_fields = jsonb_set(
            COALESCE(extracted_fields, '{}'::jsonb),
            p_field_path,
            p_value,
            true  -- create_if_missing
        ),
        confidence_scores = jsonb_set(
            COALESCE(confidence_scores, '{}'::jsonb),
            p_field_path,
            to_jsonb(p_confidence),
            true
        ),
        updated_at = NOW()
    WHERE id = p_extraction_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Remove a field at a JSON path
CREATE OR REPLACE FUNCTION remove_extraction_field(
    p_extraction_id UUID,
    p_user_id TEXT,
    p_field_path TEXT[]
) RETURNS VOID AS $$
BEGIN
    UPDATE extractions
    SET
        extracted_fields = extracted_fields #- p_field_path,
        confidence_scores = confidence_scores #- p_field_path,
        updated_at = NOW()
    WHERE id = p_extraction_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION update_extraction_field TO authenticated;
GRANT EXECUTE ON FUNCTION remove_extraction_field TO authenticated;
