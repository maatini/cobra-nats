import { test, expect } from '@playwright/test';

test.describe('Connection Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.clear());
        await page.goto('/');
    });

    test('should show empty state dashboard when no connections exist', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByText('No Active Connection')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Create New Connection' })).toBeVisible();
    });

    test('should successfully add a new NATS connection', async ({ page }) => {
        await page.goto('/');

        // Click Create New Connection
        await page.getByRole('button', { name: 'Create New Connection' }).click();

        // Fill the form
        await page.getByLabel('Connection Name').fill('Local Test');
        await page.getByLabel('Servers').fill('localhost:4222');

        // Test the connection
        const testButton = page.getByRole('button', { name: 'Test', exact: true });
        await testButton.click();

        // Wait for validation - since we might not have NATS running in the CI env 
        // we handle both success and error as long as the UI reacts
        await expect(page.getByText(/Connection successful!|Connection failed/)).toBeVisible({ timeout: 10000 });

        // Save the connection
        await page.getByRole('button', { name: 'Connect', exact: true }).click();

        // Verify it appears in the sidebar (Topbar in our case)
        await expect(page.getByRole('button', { name: 'Local Test', exact: false })).toBeVisible();
    });

    test('should switch between connections', async ({ page }) => {
        await page.addInitScript(() => {
            const state = {
                state: {
                    connections: [
                        { id: '1', name: 'Conn 1', servers: ['localhost:4222'], authType: 'none' },
                        { id: '2', name: 'Conn 2', servers: ['localhost:4223'], authType: 'none' }
                    ],
                    activeConnectionId: '1'
                },
                version: 0
            };
            localStorage.setItem('cobra-nats-storage', JSON.stringify(state));
        });
        await page.goto('/');

        // Verify Conn 1 is active
        await expect(page.getByRole('button', { name: 'Conn 1', exact: false })).toBeVisible();

        // Open connection switcher in Topbar
        await page.getByRole('button', { name: 'Conn 1', exact: false }).click();

        // Select Conn 2
        await page.getByRole('menuitem', { name: 'Conn 2' }).click();

        // Verify Conn 2 is now displayed in Topbar
        await expect(page.getByRole('button', { name: 'Conn 2', exact: false })).toBeVisible();
    });
});
