-- Add folder support to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_folder_name TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_drive_folder_id ON public.campaigns(drive_folder_id) WHERE drive_folder_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.campaigns.drive_folder_id IS 'Google Drive folder ID for automatic video discovery';
COMMENT ON COLUMN public.campaigns.drive_folder_name IS 'Display name of the Google Drive folder';