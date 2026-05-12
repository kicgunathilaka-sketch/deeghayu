import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';

export class CommitteeService {
  async getAllPanels() {
    return prisma.committeePanel.findMany({
      orderBy: { year: 'desc' },
      include: {
        roles: {
          include: {
            member: { select: { fullName: true, membershipId: true, profilePhoto: true } },
          },
        },
      },
    });
  }

  async getPanelByYear(year: number) {
    const panel = await prisma.committeePanel.findUnique({
      where: { year },
      include: {
        roles: {
          include: {
            member: { select: { fullName: true, membershipId: true, profilePhoto: true, phone: true } },
          },
        },
      },
    });
    if (!panel) throw new NotFoundError(`No panel found for year ${year}`);
    return panel;
  }

  async createPanel(year: number, notes?: string) {
    const existing = await prisma.committeePanel.findUnique({ where: { year } });
    if (existing) throw new ConflictError(`Panel for year ${year} already exists`);

    // Deactivate all existing panels
    await prisma.committeePanel.updateMany({ data: { isActive: false } });

    return prisma.committeePanel.create({
      data: { year, isActive: true, notes },
    });
  }

  async assignRole(panelId: string, memberId: string, role: Role, startDate: string, notes?: string) {
    const panel = await prisma.committeePanel.findUnique({ where: { id: panelId } });
    if (!panel) throw new NotFoundError('Panel not found');

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundError('Member not found');

    // Update user's system role
    await prisma.user.update({ where: { id: member.userId }, data: { role } });

    return prisma.committeeRole.upsert({
      where: { panelId_memberId_role: { panelId, memberId, role } },
      update: { startDate: new Date(startDate), notes },
      create: {
        panelId,
        memberId,
        role,
        startDate: new Date(startDate),
        notes,
      },
    });
  }

  async updateRole(roleId: string, data: { endDate?: string; notes?: string }) {
    return prisma.committeeRole.update({
      where: { id: roleId },
      data: {
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        notes: data.notes,
      },
    });
  }

  async getMemberHistory(memberId: string) {
    return prisma.committeeRole.findMany({
      where: { memberId },
      include: { panel: { select: { year: true } } },
      orderBy: { startDate: 'desc' },
    });
  }
}
