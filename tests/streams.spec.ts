import { test, expect } from '@playwright/test';

test.describe('JetStream Streams', () => {
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

    test('should navigate to streams page and show empty state if no streams', async ({ page }) => {
        await page.getByRole('link', { name: 'Streams', exact: true }).click();
        await expect(page).toHaveURL(/\/streams/);
        await expect(page.getByRole('heading', { name: 'JetStream Streams' })).toBeVisible();
    });

    test('should open create stream dialog', async ({ page }) => {
        await page.goto('/streams');
        await page.getByRole('button', { name: 'Create Stream' }).click();
        await expect(page.getByText('Create New Stream')).toBeVisible();
        await expect(page.getByLabel('Stream Name')).toBeVisible();
    });

    test('should fill create stream form', async ({ page }) => {
        await page.goto('/streams');
        await page.getByRole('button', { name: 'Create Stream' }).click();

        await page.getByLabel('Stream Name').fill('TEST_STREAM');
        await page.getByLabel('Subjects').fill('test.>');

        // Check default values
        await expect(page.getByLabel('Max Messages')).toHaveValue('-1');

        // We don't submit because we don't have a real NATS server in the test runner
        // but we verify the button is enabled after filling required fields
        await expect(page.getByRole('button', { name: 'Create Stream', exact: true })).toBeEnabled();
    });

    test('max_age input accepts a value and unit', async ({ page }) => {
        await page.goto('/streams');
        await page.getByRole('button', { name: 'Create Stream' }).click();

        // Value field accepts a plain number, unit defaults to Hours
        const maxAgeInput = page.getByLabel('Max Age');
        await expect(maxAgeInput).toBeVisible();
        await maxAgeInput.fill('7');
        await expect(maxAgeInput).toHaveValue('7');

        // Switch unit to Days via the Select trigger (no raw nanosecond input)
        await page.getByLabel('Unit').click();
        await page.getByRole('option', { name: 'Days' }).click();
        await expect(page.getByLabel('Unit')).toContainText('Days');

        // Submit button still enabled with required fields filled
        await page.getByLabel('Stream Name').fill('TEST_STREAM_MA');
        await page.getByLabel('Subjects').fill('test.>');
        await expect(page.getByRole('button', { name: 'Create Stream', exact: true })).toBeEnabled();
    });
});
