import api from './axiosInstance';

export const committeeApi = {
  getAllPanels: () => api.get('/committee/panels'),
  getPanelByYear: (year: number) => api.get(`/committee/panels/${year}`),
  createPanel: (data: any) => api.post('/committee/panels', data),
  assignRole: (panelId: string, data: any) => api.post(`/committee/panels/${panelId}/roles`, data),
  updateRole: (roleId: string, data: any) => api.patch(`/committee/roles/${roleId}`, data),
  getMemberHistory: (memberId: string) => api.get(`/committee/history/${memberId}`),
};
