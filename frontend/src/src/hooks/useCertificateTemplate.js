import { useState, useEffect, useCallback } from 'react';
import { certificateService } from '../services/certificateService';

const DEFAULT_TEMPLATE = {
  title: 'Certificate of Participation',
  headerText: 'IT Leaders Community Kerala',
  subTitle: 'This is proudly presented to',
  bodyText: 'This is proudly presented to {{name}} in recognition of their active participation in the event {{event_title}} held on {{date}} at {{location}}.',
  signatoryName: 'ITLC President',
  signatoryDesignation: 'IT Leaders Community',
  signatoryCompany: 'IT Leaders Community Kerala',
  signatureImage: '',
  signatureScale: 1,
  signatureOffsetX: 0,
  signatureOffsetY: 0,
  bgStyle: 'classic-gold',
  logos: []
};

export function useCertificateTemplate() {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [customLogo, setCustomLogo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [parsedTemplate, logo] = await Promise.all([
        certificateService.getGlobalTemplate(),
        certificateService.getCustomLogo()
      ]);

      if (parsedTemplate) {
        setTemplate({
          title: parsedTemplate.title || DEFAULT_TEMPLATE.title,
          headerText: parsedTemplate.headerText || DEFAULT_TEMPLATE.headerText,
          subTitle: parsedTemplate.subTitle || DEFAULT_TEMPLATE.subTitle,
          bodyText: parsedTemplate.bodyText || DEFAULT_TEMPLATE.bodyText,
          signatoryName: parsedTemplate.signatoryName || DEFAULT_TEMPLATE.signatoryName,
          signatoryDesignation: parsedTemplate.signatoryDesignation || DEFAULT_TEMPLATE.signatoryDesignation,
          signatoryCompany: parsedTemplate.signatoryCompany || DEFAULT_TEMPLATE.signatoryCompany,
          signatureImage: parsedTemplate.signatureImage || '',
          signatureScale: typeof parsedTemplate.signatureScale === 'number' ? parsedTemplate.signatureScale : 1,
          signatureOffsetX: typeof parsedTemplate.signatureOffsetX === 'number' ? parsedTemplate.signatureOffsetX : 0,
          signatureOffsetY: typeof parsedTemplate.signatureOffsetY === 'number' ? parsedTemplate.signatureOffsetY : 0,
          bgStyle: parsedTemplate.bgStyle || DEFAULT_TEMPLATE.bgStyle,
          logos: parsedTemplate.logos || []
        });
      } else {
        setTemplate(DEFAULT_TEMPLATE);
      }
      if (logo) setCustomLogo(logo);
    } catch (err) {
      console.error('Error loading certificate template:', err);
      setError(err.message || 'Failed to load certificate template');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTemplate = async (templateToSave = template) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await certificateService.saveGlobalTemplate(templateToSave);
      setSuccess('Certificate template saved successfully!');
      return true;
    } catch (err) {
      console.error('Error saving certificate template:', err);
      setError(err.message || 'Failed to save certificate template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  return {
    template,
    setTemplate,
    customLogo,
    loading,
    saving,
    error,
    setError,
    success,
    setSuccess,
    saveTemplate,
    reloadTemplate: loadTemplate
  };
}
