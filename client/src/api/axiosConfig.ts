import axios from 'axios';

function getCompanyId(): string {
  try {
    return JSON.parse(localStorage.getItem('evotrade_active_business') || '{}').id || 'evotrade';
  } catch {
    return 'evotrade';
  }
}

const api = axios.create({ baseURL: '/api' });

// Request interceptor: add JWT token and company ID headers
api.interceptors.request.use((config) => {
  config.headers['X-Company-ID'] = getCompanyId();

  // Add JWT token if available
  const token = localStorage.getItem('evotrade_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
});

// Response interceptor: handle 401 Unauthorised
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('evotrade_token');
      localStorage.removeItem('evotrade_current_id');
      localStorage.removeItem('evotrade_active_business');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
