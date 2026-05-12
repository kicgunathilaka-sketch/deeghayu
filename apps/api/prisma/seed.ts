import { PrismaClient, Role, MemberStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Super Admin
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@deeghayu.org' },
    update: {},
    create: {
      email: 'admin@deeghayu.org',
      passwordHash,
      role: Role.SUPER_ADMIN,
      isEmailVerified: true,
      member: {
        create: {
          membershipId: 'DC-0001',
          fullName: 'Super Admin',
          nic: '000000000V',
          address: 'Deeghayu Community Office',
          phone: '+94 77 000 0000',
          status: MemberStatus.ACTIVE,
        },
      },
    },
  });

  // Create Committee Panel for current year
  const currentYear = new Date().getFullYear();
  await prisma.committeePanel.upsert({
    where: { year: currentYear },
    update: {},
    create: {
      year: currentYear,
      isActive: true,
      notes: `${currentYear} Committee Panel`,
    },
  });

  // System Settings
  const settings = [
    { key: 'monthly_fee', value: '500' },
    { key: 'joining_fee', value: '1000' },
    { key: 'late_grace_minutes', value: '15' },
    { key: 'org_name', value: 'Deeghayu Community' },
    { key: 'org_email', value: 'info@deeghayu.org' },
    { key: 'org_phone', value: '+94 77 000 0000' },
    { key: 'org_address', value: 'Sri Lanka' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Seed complete!');
  console.log('📧 Admin Email: admin@deeghayu.org');
  console.log('🔑 Admin Password: Admin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
