-- Add branding_logo_url to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS branding_logo_url TEXT;
