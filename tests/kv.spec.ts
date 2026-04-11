import { test, expect } from '@playwright/test';

test.describe('KeyValue Stores', () => {
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

    test('should navigate to KV page', async ({ page }) => {
        // Wait for sidebar link to be rendered after hydration
        const kvLink = page.getByRole('link', { name: 'KV Stores', exact: true });
        await expect(kvLink).toBeVisible({ timeout: 10000 });
        await kvLink.click();
        await expect(page).toHaveURL(/\/kv/, { timeout: 10000 });
        await expect(page.getByRole('heading', { name: 'KeyValue Stores' })).toBeVisible();
    });

    test('should open create bucket dialog', async ({ page }) => {
        await page.goto('/kv');
        await page.getByRole('button', { name: 'Create KV Bucket' }).click();
        await expect(page.getByText('Create New KV Bucket')).toBeVisible();
    });

    test('should show empty state when filter matches nothing', async ({ page }) => {
        await page.goto('/kv');
        // Filter for an impossible name so the empty-state UI is deterministic
        // regardless of existing buckets on the real NATS server.
        await page.getByPlaceholder('Search buckets...').fill('___does_not_exist___');
        await expect(page.getByText('No buckets found')).toBeVisible();
    });
});
