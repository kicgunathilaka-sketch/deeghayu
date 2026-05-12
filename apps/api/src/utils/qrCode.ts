import QRCode from 'qrcode';
import { signQrToken } from './jwt';

export async function generateQrDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 400,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

export async function generateMemberQr(memberId: string, membershipId: string): Promise<string> {
  const payload = JSON.stringify({ memberId, membershipId, type: 'MEMBER' });
  return generateQrDataUrl(payload);
}

export async function generateEventQr(eventId: string, expiresAt: Date): Promise<string> {
  const token = signQrToken(eventId, expiresAt);
  const payload = JSON.stringify({ token, type: 'EVENT' });
  return generateQrDataUrl(payload);
}
