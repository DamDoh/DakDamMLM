import { ProductSeeder } from './seeders/product-seeder';
import { MemberSeeder } from './seeders/member-seeder';
import { OrderSeeder } from './seeders/order-seeder';
import { CommissionSeeder } from './seeders/commission-seeder';
import { NotificationSeeder } from './seeders/notification-seeder';
import { OnboardingSeeder } from './seeders/onboarding-seeder';
import { InventorySeeder } from './seeders/inventory-seeder';

// Interfaces moved to respective seeders

export class SeedService {
  private productSeeder = new ProductSeeder();
  private memberSeeder = new MemberSeeder();
  private orderSeeder = new OrderSeeder();
  private commissionSeeder = new CommissionSeeder();
  private notificationSeeder = new NotificationSeeder();
  private onboardingSeeder = new OnboardingSeeder();
  private inventorySeeder = new InventorySeeder();

  async seedAllData(): Promise<{
    members: number;
    commissions: number;
    orders: number;
    products: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      console.log('Starting data seeding for development...');

      // Seed in order of dependencies
      const productsCount = await this.productSeeder.seed();
      console.log(`Seeded ${productsCount} products`);

      const membersCount = await this.memberSeeder.seed();
      console.log(`Seeded ${membersCount} members`);

      const ordersCount = await this.orderSeeder.seed();
      console.log(`Seeded ${ordersCount} orders`);

      const commissionsCount = await this.commissionSeeder.seed();
      console.log(`Seeded ${commissionsCount} commissions`);

      // Seed additional data
      await this.notificationSeeder.seed();
      await this.onboardingSeeder.seed();
      await this.inventorySeeder.seed();

      console.log('Data seeding completed successfully');

      return {
        members: membersCount,
        commissions: commissionsCount,
        orders: ordersCount,
        products: productsCount,
        errors
      };

    } catch (error) {
      console.error('Seeding failed:', error);
      errors.push(`Seeding failed: ${error}`);
      return {
        members: 0,
        commissions: 0,
        orders: 0,
        products: 0,
        errors
      };
    }
  }

// All seeding methods moved to respective seeders
}