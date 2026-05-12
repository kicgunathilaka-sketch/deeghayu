import api from './axiosInstance';

export const paymentsApi = {
  getAll: (params?: any) => api.get('/payments', { params }),
  getById: (id: string) => api.get(`/payments/${id}`),
  create: (data: any) => api.post('/payments', data),
  update: (id: string, data: any) => api.patch(`/payments/${id}`, data),
  getReceipt: (id: string) => api.get(`/payments/${id}/receipt`, { responseType: 'blob' }),
  getSummary: (year: number, month?: number) => api.get('/payments/summary', { params: { year, month } }),
  getOverdue: () => api.get('/payments/overdue'),
  sendBulkReminders: (paymentIds: string[]) => api.post('/payments/bulk-reminder', { paymentIds }),
  getAnalytics: (year: number) => api.get('/payments/analytics', { params: { year } }),
};
