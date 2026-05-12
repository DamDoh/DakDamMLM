import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with test users and products...');

  const passwordHash = await bcrypt.hash('password123', 12);

  // Create default company if it doesn't exist
  const defaultCompany = await prisma.company.upsert({
    where: { name: 'DakDam MLM' },
    update: {
      isActive: true,
      isVerified: true,
    },
    create: {
      name: 'DakDam MLM',
      domain: 'dakdam',
      description: 'Default MLM company for DakDam platform',
      email: 'admin@dakdam.com',
      phone: '+1234567890',
      country: 'US',
      currency: 'USD',
      timezone: 'UTC',
      isActive: true,
      isVerified: true,
      allowEmailLogin: true,
      allowPhoneLogin: true,
      requireEmailVerification: false,
      requirePhoneVerification: false,
    },
  });

  console.log('✅ Default company created/updated:', defaultCompany.name);

  const common = {
    companyId: defaultCompany.id,
    addresses: [],
    teamSize: { left: 0, right: 0, total: 0 },
    children: { left: null, right: null },
    rank: 'Member',
    accountType: 'Distributor',
    pv: 0,
    active: true,
  };

  // 1. Admin Account
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dakdam.com' },
    update: {
      password: passwordHash,
      isAdmin: true,
    },
    create: {
      ...common,
      email: 'admin@dakdam.com',
      password: passwordHash,
      firstName: 'DakDam',
      surname: 'Admin',
      fullName: 'DakDam Admin',
      phoneNumber: '+1234567890',
      memberId: 'ADM001',
      isAdmin: true,
      rank: 'Diamond',
      pv: 10000,
      teamSize: { left: 150, right: 145, total: 295 },
    },
  });

  // 2. John Doe (Gold Member)
  const john = await prisma.user.upsert({
    where: { email: 'john.doe@dakdam.com' },
    update: {
      password: passwordHash,
    },
    create: {
      ...common,
      email: 'john.doe@dakdam.com',
      password: passwordHash,
      firstName: 'John',
      surname: 'Doe',
      fullName: 'John Doe',
      phoneNumber: '+1234567891',
      memberId: 'MEM001',
      isAdmin: false,
      rank: 'Gold',
      pv: 2500,
      teamSize: { left: 25, right: 30, total: 55 },
      sponsorId: admin.id,
      placementParentId: admin.id,
      position: 'left',
    },
  });

  // 3. Jane Smith (Silver Member)
  const jane = await prisma.user.upsert({
    where: { email: 'jane.smith@dakdam.com' },
    update: {
      password: passwordHash,
    },
    create: {
      ...common,
      email: 'jane.smith@dakdam.com',
      password: passwordHash,
      firstName: 'Jane',
      surname: 'Smith',
      fullName: 'Jane Smith',
      phoneNumber: '+1234567892',
      memberId: 'MEM002',
      isAdmin: false,
      rank: 'Silver',
      pv: 1200,
      teamSize: { left: 15, right: 20, total: 35 },
      sponsorId: admin.id,
      placementParentId: admin.id,
      position: 'right',
    },
  });

  // 4. Mike Johnson (Basic Member)
  await prisma.user.upsert({
    where: { email: 'mike.johnson@dakdam.com' },
    update: {
      password: passwordHash,
    },
    create: {
      ...common,
      email: 'mike.johnson@dakdam.com',
      password: passwordHash,
      firstName: 'Mike',
      surname: 'Johnson',
      fullName: 'Mike Johnson',
      phoneNumber: '+1234567893',
      memberId: 'MEM003',
      isAdmin: false,
      pv: 450,
      teamSize: { left: 0, right: 0, total: 0 },
      sponsorId: john.id,
      placementParentId: john.id,
      position: 'left',
      accountType: 'Customer',
    },
  });

  // 5. Sarah Williams (Basic Member)
  await prisma.user.upsert({
    where: { email: 'sarah.williams@dakdam.com' },
    update: {
      password: passwordHash,
    },
    create: {
      ...common,
      email: 'sarah.williams@dakdam.com',
      password: passwordHash,
      firstName: 'Sarah',
      surname: 'Williams',
      fullName: 'Sarah Williams',
      phoneNumber: '+1234567894',
      memberId: 'MEM004',
      isAdmin: false,
      pv: 380,
      teamSize: { left: 0, right: 0, total: 0 },
      sponsorId: jane.id,
      placementParentId: jane.id,
      position: 'right',
      accountType: 'Customer',
    },
  });

  // Update admin's children to reflect the genealogy
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      children: { left: john.id, right: jane.id },
    },
  });

  // Update John's children
  const mike = await prisma.user.findUnique({ where: { email: 'mike.johnson@dakdam.com' } });
  if (mike) {
    await prisma.user.update({
      where: { id: john.id },
      data: {
        children: { left: mike.id, right: null },
      },
    });
  }

  // Update Jane's children
  const sarah = await prisma.user.findUnique({ where: { email: 'sarah.williams@dakdam.com' } });
  if (sarah) {
    await prisma.user.update({
      where: { id: jane.id },
      data: {
        children: { left: null, right: sarah.id },
      },
    });
  }

  // Seed sample products
  const products = [
    {
      name: 'Vitamin C Supplement',
      description: 'High-quality Vitamin C supplement for daily health',
      price: 25.99,
      pv: 20,
      qty: 100,
      category: 'Health & Wellness',
      isActive: true,
    },
    {
      name: 'Protein Powder',
      description: 'Premium protein powder for fitness enthusiasts',
      price: 45.99,
      pv: 35,
      qty: 50,
      category: 'Fitness',
      isActive: true,
    },
    {
      name: 'Essential Oils Set',
      description: 'Collection of essential oils for wellness',
      price: 35.99,
      pv: 28,
      qty: 30,
      category: 'Wellness',
      isActive: true,
    },
    {
      name: 'Herbal Tea Collection',
      description: 'Premium herbal tea collection',
      price: 19.99,
      pv: 15,
      qty: 75,
      category: 'Beverages',
      isActive: true,
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });
    
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
    } else {
      await prisma.product.create({
        data: product,
      });
    }
  }

  console.info('✅ Seeding completed successfully!');
  console.info('📝 Test accounts created:');
  console.info('   - admin@dakdam.com / password123 (Admin)');
  console.info('   - john.doe@dakdam.com / password123 (Gold Member)');
  console.info('   - jane.smith@dakdam.com / password123 (Silver Member)');
  console.info('   - mike.johnson@dakdam.com / password123 (Basic Member)');
  console.info('   - sarah.williams@dakdam.com / password123 (Basic Member)');
  console.info('📦 4 sample products created');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

