import { prisma } from '../config/database';
import { config } from '../config';

export async function generateMembershipId(): Promise<string> {
  const count = await prisma.member.count();
  const nextNum = count + 1;
  return `${config.membershipPrefix}-${String(nextNum).padStart(4, '0')}`;
}
