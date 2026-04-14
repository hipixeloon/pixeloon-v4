import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  signup_enabled: boolean;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({ signup_enabled: true });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['signup_enabled']);

      if (error) throw error;

      const newSettings: AppSettings = { signup_enabled: true };
      data?.forEach((row) => {
        if (row.key === 'signup_enabled') {
          newSettings.signup_enabled = row.value === true || row.value === 'true';
        }
      });

      setSettings(newSettings);
    } catch (error) {
      console.error('Error fetching app settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: boolean) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;

      setSettings((prev) => ({ ...prev, [key]: value }));
      return { success: true };
    } catch (error) {
      console.error('Error updating setting:', error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, updateSetting, refetch: fetchSettings };
}
