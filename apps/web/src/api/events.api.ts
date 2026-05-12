import api from './axiosInstance';

export const eventsApi = {
  getAll: (params?: any) => api.get('/events', { params }),
  getById: (id: string) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: string, data: any) => api.patch(`/events/${id}`, data),
  publish: (id: string) => api.post(`/events/${id}/publish`),
  openAttendance: (id: string) => api.post(`/events/${id}/open-attendance`),
  getQr: (id: string) => api.get(`/events/${id}/qr`),
  rsvp: (id: string, response: string) => api.post(`/events/${id}/rsvp`, { response }),
  getAttendance: (id: string) => api.get(`/events/${id}/attendance`),
  addGalleryPhoto: (id: string, data: any) => api.post(`/events/${id}/gallery`, data),
  sendReminders: (id: string) => api.post(`/events/${id}/reminders`),
};
