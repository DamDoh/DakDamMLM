import { SeedService } from '../src/lib/seed-service';

async function main() {
  console.log('🌱 Starting database seeding...\n');
  
  const seedService = new SeedService();
  const result = await seedService.seedAllData();
  
  console.log('\n✅ Seeding Summary:');
  console.log(`   Products: ${result.products}`);
  console.log(`   Members: ${result.members}`);
  console.log(`   Orders: ${result.orders}`);
  console.log(`   Commissions: ${result.commissions}`);
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    result.errors.forEach(error => console.log(`   ${error}`));
  } else {
    console.log('\n🎉 Database seeded successfully!');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });