import { test, expect } from '@playwright/test';

test.describe('Object Stores', () => {
    test.beforeEach(async ({ page }) => {
        // Setup a connection in localStorage
        await page.goto('/');
        await page.evaluate(() => {
            const state = {
                state: {
                    connections: [
                        { id: '1', name: 'Local', servers: ['localhost:4222'], authType: 'none' }
                    ],
                    activeConnectionId: '1'
                },
                version: 0
            };
            localStorage.setItem('cobra-nats-storage', JSON.stringify(state));
        });
        await page.reload();
    });

    test('should navigate to OS page', async ({ page }) => {
        // Wait for sidebar link to be rendered after hydration
        const osLink = page.getByRole('link', { name: 'Object Store', exact: true });
        await expect(osLink).toBeVisible({ timeout: 10000 });
        await osLink.click();
        await expect(page).toHaveURL(/\/os/, { timeout: 10000 });
        await expect(page.getByRole('heading', { name: 'Object Stores' })).toBeVisible();
    });

    test('should open create bucket dialog', async ({ page }) => {
        await page.goto('/os');
        await page.getByRole('button', { name: 'Create Object Store' }).click();
        await expect(page.getByText('Create New Object Store')).toBeVisible();
    });

    test('should render OS page listing or empty state', async ({ page }) => {
        await page.goto('/os');
        // The page may or may not have buckets depending on previous test runs —
        // assert only that the OS view rendered.
        await expect(page.getByRole('heading', { name: 'Object Stores' })).toBeVisible();
    });
});
