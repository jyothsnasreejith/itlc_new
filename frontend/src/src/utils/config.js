const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  || 'http://localhost:5000/api';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const REMOTE_UPLOAD_URL = isLocal 
  ? `${API_URL}/upload`
  : "https://gravity-innovations.com/itlc/upload.php";

export const MEDIA_BASE_URL = isLocal 
  ? "http://localhost:5000" 
  : "https://gravity-innovations.com/itlc";

export function getImageUrl(url, defaultFolder = 'members') {
  if (!url) return '';
  if (typeof url !== 'string') return url;

  if (url.startsWith('data:')) return url;

  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('/uploads/') || url.startsWith('uploads/')) {
    const filename = url.split('/').pop();
    const folder = (filename.toLowerCase().includes('event') || defaultFolder === 'events') ? 'events' : 'members';
    return `https://gravity-innovations.com/itlc/${folder}/${filename}`;
  }

  return url;
}

