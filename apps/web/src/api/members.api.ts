import api from './axiosInstance';

export const membersApi = {
  getAll: (params?: any) => api.get('/members', { params }),
  getById: (id: string) => api.get(`/members/${id}`),
  update: (id: string, data: any) => api.patch(`/members/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/members/${id}/status`, { status }),
  getQr: (id: string) => api.get(`/members/${id}/qr`),
  getPayments: (id: string, params?: any) => api.get(`/members/${id}/payments`, { params }),
  getAttendance: (id: string, params?: any) => api.get(`/members/${id}/attendance`, { params }),
  export: (format: string, params?: any) =>
    api.get('/members/export', { params: { format, ...params }, responseType: 'blob' }),
};
