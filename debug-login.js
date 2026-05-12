const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function debugLogin() {
  try {
    console.log('🔍 Debugging Login Issue...\n');
    
    // Check if users exist
    const userCount = await prisma.user.count();
    console.log(`✅ Total users in database: ${userCount}\n`);
    
    // Get admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@dakdam.com' },
      select: {
        id: true,
        email: true,
        memberId: true,
        fullName: true,
        password: true,
        active: true,
        isAdmin: true
      }
    });
    
    if (!adminUser) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    console.log('✅ Admin user found:');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Member ID: ${adminUser.memberId}`);
    console.log(`   Full Name: ${adminUser.fullName}`);
    console.log(`   Active: ${adminUser.active}`);
    console.log(`   Is Admin: ${adminUser.isAdmin}`);
    console.log(`   Password hash length: ${adminUser.password.length}`);
    console.log(`   Password starts with: ${adminUser.password.substring(0, 10)}...\n`);
    
    // Test password verification
    const testPassword = 'password123';
    console.log(`🔐 Testing password: "${testPassword}"`);
    
    const isValid = await bcrypt.compare(testPassword, adminUser.password);
    console.log(`   Password verification result: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    
    if (!isValid) {
      console.log('⚠️  Password verification failed!');
      console.log('   This suggests the seeded password hash does not match "password123"');
      console.log('\n💡 Solution: Re-hash the password correctly');
      
      // Create correct hash
      const correctHash = await bcrypt.hash(testPassword, 12);
      console.log(`\n   New hash for "${testPassword}": ${correctHash.substring(0, 20)}...`);
      console.log(`   Hash length: ${correctHash.length}`);
    } else {
      console.log('✅ Password verification successful!');
      console.log('   The issue must be elsewhere in the login flow.');
    }
    
  } catch (error) {
    console.error('❌ Error during debug:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLogin();