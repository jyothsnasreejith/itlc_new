import { supabase } from '../lib/supabase';

export const certificateService = {
  async getGlobalTemplate() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('setting_key', 'cert_template_global')
      .maybeSingle();

    if (error) throw new Error(error.message || 'Failed to load certificate template');

    if (data && data.setting_value) {
      try {
        return JSON.parse(data.setting_value);
      } catch (err) {
        console.error('Error parsing certificate template JSON:', err);
      }
    }
    return null;
  },

  async saveGlobalTemplate(templateData) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        setting_key: 'cert_template_global',
        setting_value: JSON.stringify(templateData),
        description: 'Global certificate template settings applied to all events'
      });

    if (error) throw new Error(error.message || 'Failed to save certificate template');
    return true;
  },

  async getCustomLogo() {
    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) return savedLogo;

    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'custom_logo')
      .maybeSingle();

    return data?.setting_value || '';
  }
};
