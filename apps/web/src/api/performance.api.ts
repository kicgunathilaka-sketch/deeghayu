import api from './axiosInstance';

export const performanceApi = {
  getAll: () => api.get('/performance'),
  getById: (memberId: string) => api.get(`/performance/${memberId}`),
};
