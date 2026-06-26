import api from './axiosInstance';

export const votesApi = {
  getAll: () => api.get('/votes'),
  getById: (id: string) => api.get(`/votes/${id}`),
  create: (data: any) => api.post('/votes', data),
  setStatus: (id: string, status: string) => api.patch(`/votes/${id}/status`, { status }),
  respond: (id: string, response: string) => api.post(`/votes/${id}/respond`, { response }),
  removeResponse: (id: string) => api.delete(`/votes/${id}/respond`),
  delete: (id: string) => api.delete(`/votes/${id}`),
};
