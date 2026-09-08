import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Attach JWT token from localStorage to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tutor_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/')) {
      // Clear token if expired
      localStorage.removeItem('tutor_token');
      localStorage.removeItem('tutor_user');
    }
    return Promise.reject(error);
  }
);

/* ================= AUTH API ================= */
export async function loginUser(credential, password) {
  const { data } = await api.post('/auth/login', { credential, password });
  if (data.token) {
    localStorage.setItem('tutor_token', data.token);
    localStorage.setItem('tutor_user', JSON.stringify(data.user));
  }
  return data;
}

export async function registerUser(username, email, password) {
  const { data } = await api.post('/auth/register', { username, email, password });
  if (data.token) {
    localStorage.setItem('tutor_token', data.token);
    localStorage.setItem('tutor_user', JSON.stringify(data.user));
  }
  return data;
}

export async function fetchProfile() {
  const { data } = await api.get('/auth/profile');
  return data;
}

export function logoutUser() {
  localStorage.removeItem('tutor_token');
  localStorage.removeItem('tutor_user');
}

export function getStoredUser() {
  const user = localStorage.getItem('tutor_user');
  return user ? JSON.parse(user) : null;
}

/* ================= TUTOR API ================= */
export async function fetchActiveSession() {
  const { data } = await api.get('/code/session/active');
  return data.session;
}

export async function createNewSession(language = 'javascript') {
  const { data } = await api.post('/code/session/new', { language });
  return data.session;
}


export async function submitCodeReview({ code, language, problemDescription, sessionId, title }) {
  const { data } = await api.post('/code-review', {
    code,
    language,
    problemDescription,
    sessionId,
    title
  });
  return data;
}

export async function getNextHint(params) {
  const payload = typeof params === 'string' ? { sessionId: params } : params;
  const { data } = await api.post('/hint/next', payload);
  return data;
}

export async function explainWhy({ code, language, errorDescription, snippet, line, sessionId }) {
  const { data } = await api.post('/code/explain-why', {
    code,
    language,
    errorDescription,
    snippet,
    line,
    sessionId
  });
  return data;
}

export async function executeCode({ code, language, stdin = '' }) {
  const { data } = await api.post('/code/execute', {
    code,
    language,
    stdin
  });
  return data;
}

export async function markSessionSolved(sessionId) {
  const { data } = await api.post('/code/session/mark-solved', { sessionId });
  return data;
}

export async function sendChat({ message, language, code, sessionId }) {
  const { data } = await api.post('/chat', {
    message,
    language,
    code,
    sessionId,
    stream: false
  });
  return data;
}

export async function fetchProgress(userId = 'me') {
  const { data } = await api.get(`/progress/${userId}`);
  return data;
}

export default api;
