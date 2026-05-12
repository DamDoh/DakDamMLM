import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('input[placeholder*="email or phone"]')).toBeVisible();
  });

  test('should load registration page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('text=Register New Account')).toBeVisible();
  });

  test('should allow a user to register and then log in', async ({ page }) => {
    await page.goto('/register');

    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const uniquePhoneNumber = `+1555${String(Date.now()).slice(-7)}`;
    const password = 'Password123!';

    // --- Registration ---
    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Surname').fill('User');
    await page.getByLabel('Phone Number').fill(uniquePhoneNumber);
    await page.getByLabel('Email Address (Optional)').fill(uniqueEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Confirm New Password').fill(password);

    // Select account type
    await page.getByLabel('Distributor (Participate in the compensation plan)').click();

    await page.getByRole('button', { name: 'Register Account' }).click();

    // After registration, we should be redirected to the login page.
    await page.waitForURL('/auth/login');
    await expect(page.locator('text=Member Login')).toBeVisible();

    // --- Login ---
    await page.getByLabel('Email or Phone Number').fill(uniqueEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // After login, we should be redirected to the dashboard.
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
  });

  test('should switch languages correctly', async ({ page }) => {
    await page.goto('/auth/login');

    // Check initial English text
    await expect(page.locator('text=Member Login')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();

    // Click language selector
    await page.locator('[data-testid="language-selector"]').click();

    // Switch to Khmer
    await page.locator('text=ភាសាខ្មែរ').click();

    // Check Khmer text appears
    await expect(page.locator('text=ចូលគណនីសមាជិក')).toBeVisible();
    await expect(page.locator('button:has-text("ចូល")')).toBeVisible();

    // Switch to Vietnamese
    await page.locator('[data-testid="language-selector"]').click();
    await page.locator('text=Tiếng Việt').first().click();

    // Check Vietnamese text appears
    await expect(page.locator('text=Đăng nhập thành viên')).toBeVisible();
    await expect(page.locator('button:has-text("Đăng nhập")')).toBeVisible();

    // Switch to Chinese
    await page.locator('[data-testid="language-selector"]').click();
    await page.locator('text=中文').first().click();

    // Check Chinese text appears
    await expect(page.locator('text=成员登录')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();

    // Switch back to English
    await page.locator('[data-testid="language-selector"]').click();
    await page.locator('text=English').first().click();

    // Verify English is back
    await expect(page.locator('text=Member Login')).toBeVisible();
  });

  test('should persist language selection', async ({ page, context }) => {
    await page.goto('/auth/login');

    // Switch to Khmer
    await page.locator('[data-testid="language-selector"]').click();
    await page.locator('text=ភាសាខ្មែរ').click();

    // Verify Khmer text
    await expect(page.locator('text=ចូលគណនីសមាជិក')).toBeVisible();

    // Create new page in same context to test persistence
    const newPage = await context.newPage();
    await newPage.goto('/auth/login');

    // Should still be in Khmer
    await expect(newPage.locator('text=ចូលគណនីសមាជិក')).toBeVisible();

    await newPage.close();
  });
});
