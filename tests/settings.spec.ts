import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
    test('should navigate to settings and display connections', async ({ page }) => {
        await page.goto('/');

        // Wait for sidebar to be visible
        await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();

        // Click on Settings in the sidebar
        await page.getByRole('link', { name: 'Settings', exact: true }).click();

        // Verify URL
        await expect(page).toHaveURL(/\/settings/);

        // Verify page header
        await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

        // Verify connections section exists
        await expect(page.getByRole('heading', { name: 'Connections', level: 2 })).toBeVisible();

        // Verify app info section exists
        await expect(page.getByRole('heading', { name: 'Application Info', level: 2 })).toBeVisible();
    });
});
