// Migration utilities - now uses the separate SeedService
import { SeedService } from './seed-service';

export async function runSeed(): Promise<{
  members: number;
  commissions: number;
  orders: number;
  products: number;
  errors: string[];
}> {
  const seedService = new SeedService();
  return await seedService.seedAllData();
}

// Legacy migration functions can be added here if needed
// For now, this file serves as a bridge to the new SeedService