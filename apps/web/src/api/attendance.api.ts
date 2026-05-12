import api from './axiosInstance';

export const attendanceApi = {
  scan: (qrPayload: string) => api.post('/attendance/scan', { qrPayload }),
  getLive: (eventId: string) => api.get(`/attendance/${eventId}`),
  getMemberHistory: (memberId: string) => api.get(`/attendance/member/${memberId}`),
  getAnalytics: () => api.get('/attendance/analytics'),
};
