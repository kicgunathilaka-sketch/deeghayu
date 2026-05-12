import api from './axiosInstance';

export const reportsApi = {
  getDashboardStats: () => api.get('/reports/dashboard/stats'),
  getFinancialReport: (year: number) => api.get('/reports/finance', { params: { year } }),
  exportReport: (type: string, format: string, params?: any) =>
    api.get('/reports/export', { params: { type, format, ...params }, responseType: 'blob' }),
};
