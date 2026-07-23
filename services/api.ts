const API_BASE = '';

function getToken() {
  return localStorage.getItem('atv_token') || '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    try {
      const payload = JSON.parse(text);
      throw new Error(payload.error || res.statusText);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text || res.statusText);
      throw error;
    }
  }
  return res.json();
}

export type RegisterPayload = {
  email: string;
  password: string;
  nickname: string;
  role: 'student' | 'teacher';
  grade?: string;
  teacherSubjects?: string[];
};

export const authService = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  register: (payload: RegisterPayload) =>
    request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  me: () => request<any>('/api/auth/me'),
  logout: () => request<any>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (payload: { nickname?: string; teacherSubjects?: string[]; grade?: string }) =>
    request<{ user: any }>('/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
};

export const catalogService = {
  subjects: () => request<any[]>('/api/catalog/subjects'),
  grades: () => request<any[]>('/api/catalog/grades'),
  categories: (subject?: string, grade?: string, q?: string) => {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (grade) params.set('grade', grade);
    if (q) params.set('q', q);
    return request<any[]>(`/api/catalog/categories?${params.toString()}`);
  },
  knowledgePoints: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    return request<any[]>(`/api/catalog/knowledge-points?${q.toString()}`);
  },
  knowledgePoint: (id: string) => request<any>(`/api/catalog/knowledge-points/${id}`),
  animationPacks: () => request<any[]>('/api/catalog/animation-packs')
};

export const jobService = {
  preflight: (payload: any) => request<any>('/api/jobs/preflight', { method: 'POST', body: JSON.stringify(payload) }),
  create: (payload: any) => request<any>('/api/jobs', { method: 'POST', body: JSON.stringify(payload) }),
  list: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any[]>(`/api/jobs?${q.toString()}`);
  },
  get: (id: string) => request<any>(`/api/jobs/${id}`),
  retry: (id: string) => request<any>(`/api/jobs/${id}/retry`, { method: 'POST' }),
  cancel: (id: string) => request<any>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
  assets: (id: string) => request<any[]>(`/api/jobs/${id}/assets`)
};

export const courseService = {
  listPublic: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any[]>(`/api/courses?${q.toString()}`);
  },
  mine: () => request<any[]>('/api/me/courses'),
  get: (id: string) => request<any>(`/api/courses/${id}`),
  submit: (id: string) => request<any>(`/api/courses/${id}/submit`, { method: 'POST' }),
  assets: (id: string) => request<any[]>(`/api/courses/${id}/assets`),
  reviews: (id: string) => request<any[]>(`/api/courses/${id}/reviews`),
  delete: (id: string) => request<any>(`/api/courses/${id}`, { method: 'DELETE' })
};

export const teacherService = {
  pending: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any[]>(`/api/teacher/reviews/pending?${q.toString()}`);
  },
  done: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any[]>(`/api/teacher/reviews/done?${q.toString()}`);
  },
  get: (id: string) => request<any>(`/api/teacher/courses/${id}`),
  review: (id: string, action: 'approve' | 'reject', comment = '') =>
    request<any>(`/api/teacher/courses/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, comment })
    })
};

export const adminService = {
  stats: () => request<any>('/api/admin/stats'),
  config: () => request<any>('/api/admin/config'),
  updateConfig: (patch: Record<string, unknown>) => request<any>('/api/admin/config', {
    method: 'PUT',
    body: JSON.stringify(patch)
  }),
  jobs: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any[]>(`/api/admin/jobs?${q.toString()}`);
  },
  pendingCourses: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams({ publishStatus: 'pending', ...params });
    return request<any[]>(`/api/admin/courses?${q.toString()}`);
  },
  review: (id: string, action: 'approve' | 'reject', comment = '') =>
    request<any>(`/api/admin/courses/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, comment })
    }),
  deleteCourse: (id: string) =>
    request<any>(`/api/admin/courses/${id}`, { method: 'DELETE' }),
  listUsers: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any[]>(`/api/admin/users?${q.toString()}`);
  },
  updateUser: (id: string, payload: Record<string, unknown>) =>
    request<{ user: any }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  listSubjects: () => request<any[]>('/api/admin/subjects'),
  upsertSubject: (payload: Record<string, unknown>) =>
    request<any>('/api/admin/subjects', { method: 'POST', body: JSON.stringify(payload) }),
  updateSubject: (code: string, payload: Record<string, unknown>) =>
    request<any>(`/api/admin/subjects/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  listKnowledgePoints: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    return request<any[]>(`/api/admin/knowledge-points?${q.toString()}`);
  },
  createKnowledgePoint: (payload: Record<string, unknown>) =>
    request<any>('/api/admin/knowledge-points', { method: 'POST', body: JSON.stringify(payload) }),
  updateKnowledgePoint: (id: string, payload: Record<string, unknown>) =>
    request<any>(`/api/admin/knowledge-points/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteKnowledgePoint: (id: string) =>
    request<any>(`/api/admin/knowledge-points/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  syncKnowledgePacks: (payload: { overwrite?: boolean } = {}) =>
    request<any>('/api/admin/knowledge-points/sync', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  syncChemAIForgeKnowledge: (payload: { overwrite?: boolean } = {}) =>
    request<any>('/api/admin/knowledge-points/sync-chemaiforge', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  syncJuniorChineseKnowledge: (payload: { overwrite?: boolean } = {}) =>
    request<any>('/api/admin/knowledge-points/sync-junior-chinese', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  syncJuniorEnglishKnowledge: (payload: { overwrite?: boolean } = {}) =>
    request<any>('/api/admin/knowledge-points/sync-junior-english', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  syncJuniorHistoryKnowledge: (payload: { overwrite?: boolean } = {}) =>
    request<any>('/api/admin/knowledge-points/sync-junior-history', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  syncJuniorGeographyKnowledge: (payload: { overwrite?: boolean } = {}) =>
    request<any>('/api/admin/knowledge-points/sync-junior-geography', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  syncJuniorPoliticsKnowledge: (payload: { overwrite?: boolean } = {}) =>
    request<any>('/api/admin/knowledge-points/sync-junior-politics', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};


export const modelSettingsService = {
  catalog: () => request<any>('/api/models/catalog'),
  get: () => request<any>('/api/me/model-settings'),
  update: (payload: Record<string, unknown>) =>
    request<any>('/api/me/model-settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  reset: () =>
    request<any>('/api/me/model-settings/reset', {
      method: 'POST'
    })
};
