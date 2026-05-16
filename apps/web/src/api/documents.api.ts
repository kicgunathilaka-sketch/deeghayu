import api from './axiosInstance';

export const documentsApi = {
  createLetter: (data: {
    receiverName: string;
    receiverDesignation?: string;
    receiverAddress: string;
    subject?: string;
    content: string;
    senderName?: string;
    senderDesignation?: string;
  }) =>
    api.post('/documents/letter', data, { responseType: 'blob' }),
};
