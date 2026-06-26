import api from './axiosInstance';

export const expensesApi = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.patch(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
};

export const expenseGroupsApi = {
  getAll: (params?: any) => api.get('/expenses/groups', { params }),
  getById: (id: string) => api.get(`/expenses/groups/${id}`),
  create: (data: any) => api.post('/expenses/groups', data),
  delete: (id: string) => api.delete(`/expenses/groups/${id}`),
};
