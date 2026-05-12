import api from './axiosInstance';

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  broadcast: (data: any) => api.post('/notifications/broadcast', data),
};
