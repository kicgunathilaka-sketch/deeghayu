import api from './axiosInstance';

export const reportsApi = {
  getDashboardStats: () => api.get('/reports/dashboard/stats'),
  getFinancialReport: (year: number) => api.get('/reports/finance', { params: { year } }),
  getMonthlyReport: (year: number, month: number) =>
    api.get('/reports/monthly', { params: { year, month }, responseType: 'blob' }),
  exportReport: (type: string, format: string, params?: any) =>
    api.get('/reports/export', { params: { type, format, ...params }, responseType: 'blob' }),
};
