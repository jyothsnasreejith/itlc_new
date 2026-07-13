const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  || 'http://localhost:5000/api';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const REMOTE_UPLOAD_URL = isLocal 
  ? `${API_URL}/upload`
  : "https://gravity-innovations.com/itlc/upload.php";

export const MEDIA_BASE_URL = isLocal 
  ? "http://localhost:5000" 
  : "https://gravity-innovations.com/itlc";
