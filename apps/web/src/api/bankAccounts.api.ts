import api from './axiosInstance';

export const bankAccountsApi = {
  getAll: () => api.get('/bank-accounts'),
  create: (data: any) => api.post('/bank-accounts', data),
  update: (id: string, data: any) => api.patch(`/bank-accounts/${id}`, data),
};
