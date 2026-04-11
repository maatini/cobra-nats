import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the two critical features added in Priority 1:
 *   - Message Browser (stream detail → Messages tab)
 *   - Consumer Creation Dialog (stream detail → Consumers tab)
 *
 * Requires a real NATS server on localhost:4222. The test creates its own
 * stream, publishes a JSON message to it via the Publish UI, then inspects
 * the stream detail page. A pull consumer is created and deleted as part of
 * the same flow. Finally the stream is deleted via the Radix confirm dialog.
 */
test.describe('Consumer Creation + Message Browser', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            const state = {
                state: {
                    connections: [
                        { id: '1', name: 'Real NATS', servers: ['localhost:4222'], authType: 'none' }
                    ],
                    activeConnectionId: '1'
                },
                version: 0
            };
            localStorage.setItem('cobra-nats-storage', JSON.stringify(state));
        });
        await page.reload();
    });

    test('browse messages, create + delete a pull consumer, then clean up', async ({ page }) => {
        const streamName = `TEST_MB_${Date.now()}`;
        const baseSubject = `${streamName}.orders`;
        const consumerName = 'e2e-pull';

        // --- 1. Create stream ---
        await page.goto('/streams');
        await expect(page.getByRole('button', { name: 'Create Stream', exact: true })).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Create Stream', exact: true }).click();
        await page.getByLabel('Stream Name').fill(streamName);
        await page.getByLabel('Subjects').fill(`${streamName}.>`);
        // Scope submit click to the dialog and fire a native DOM click — the Radix
        // open animation can micro-shift the submit button, tripping Playwright's
        // stability check.
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Create Stream', exact: true })
            .evaluate((el: HTMLButtonElement) => el.click());
        await expect(page.getByText(`Stream "${streamName}" created successfully`)).toBeVisible({ timeout: 15000 });

        // --- 2. Publish a JSON message to the stream's subject ---
        await page.getByRole('link', { name: 'Publish', exact: true }).click();
        await expect(page).toHaveURL(/\/publish/);
        await page.getByPlaceholder('orders.new').fill(baseSubject);
        await page.locator('textarea').fill('{"id":1,"status":"ok"}');
        await page.getByRole('button', { name: 'Publish Message' }).click();
        await expect(page.getByText('Message published')).toBeVisible({ timeout: 10000 });

        // --- 3. Navigate to stream detail page ---
        await page.getByRole('link', { name: 'Streams', exact: true }).click();
        await page.getByPlaceholder('Search streams...').fill(streamName);
        const row = page.locator('tr', { hasText: streamName });
        await row.getByRole('button', { name: 'Open menu' }).click();
        await page.getByRole('menuitem', { name: 'View Details' }).click();
        await expect(page).toHaveURL(new RegExp(`\/streams\/${streamName}`));

        // --- 4. Message Browser: load and verify the published message ---
        await page.getByRole('tab', { name: /Messages/ }).click();
        await expect(page.getByText(/Message Browser/)).toBeVisible();

        const loadBtn = page.getByRole('button', { name: 'Load Messages' });
        await expect(loadBtn).toBeEnabled();
        await loadBtn.click();

        // First message should be visible with sequence #1 and correct subject
        await expect(page.getByText('#1', { exact: true })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(baseSubject, { exact: true }).first()).toBeVisible();

        // Expand the row and assert the JSON badge + highlighted key appear
        await page.getByText('#1', { exact: true }).click();
        await expect(page.getByText('JSON', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('"status"', { exact: false })).toBeVisible();

        // --- 5. Consumer Creation ---
        await page.getByRole('tab', { name: /Consumers/ }).click();
        await expect(page.getByRole('heading', { name: 'Processing Consumers', exact: true })).toBeVisible();

        // Empty-state CTA or header button — either opens the same dialog
        await page.getByRole('button', { name: 'Add Consumer' }).first().click();

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: /Create Consumer/ })).toBeVisible();

        // Pull mode is the default; fill the required durable name
        await dialog.getByLabel('Durable Name').fill(consumerName);
        await dialog.getByLabel('Filter Subject (optional)').fill(`${streamName}.>`);
        await dialog
            .getByRole('button', { name: 'Create Consumer' })
            .evaluate((el: HTMLButtonElement) => el.click());

        await expect(page.getByText(`Consumer "${consumerName}" created`)).toBeVisible({ timeout: 10000 });
        // Consumer row shows up with PULL badge
        const consumerRow = page.locator('tr', { hasText: consumerName });
        await expect(consumerRow).toBeVisible({ timeout: 10000 });
        await expect(consumerRow.getByText('PULL', { exact: true })).toBeVisible();

        // Delete the consumer
        await consumerRow.getByRole('button').last().click();
        await expect(page.getByText('Consumer deleted')).toBeVisible({ timeout: 10000 });

        // --- 6. Delete stream via Radix confirm dialog ---
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete stream/)).toBeVisible();
        await confirmDialog.getByRole('button', { name: 'Delete Stream' }).click();
        await expect(page.getByText('Stream deleted')).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveURL(/\/streams/);
    });

    test('cancel on confirm dialog keeps the stream alive', async ({ page }) => {
        const streamName = `TEST_CANCEL_${Date.now()}`;

        // Create a disposable stream
        await page.goto('/streams');
        await expect(page.getByRole('button', { name: 'Create Stream', exact: true })).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Create Stream', exact: true }).click();
        await page.getByLabel('Stream Name').fill(streamName);
        await page.getByLabel('Subjects').fill(`${streamName}.>`);
        // Scope submit click to the dialog and fire a native DOM click — the Radix
        // open animation can micro-shift the submit button, tripping Playwright's
        // stability check.
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Create Stream', exact: true })
            .evaluate((el: HTMLButtonElement) => el.click());
        await expect(page.getByText(`Stream "${streamName}" created successfully`)).toBeVisible({ timeout: 15000 });

        // Open it
        await page.getByPlaceholder('Search streams...').fill(streamName);
        const row = page.locator('tr', { hasText: streamName });
        await row.getByRole('button', { name: 'Open menu' }).click();
        await page.getByRole('menuitem', { name: 'View Details' }).click();

        // Open confirm dialog then cancel
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete stream/)).toBeVisible();
        await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

        // Still on detail page, stream still exists
        await expect(page).toHaveURL(new RegExp(`\/streams\/${streamName}`));
        await expect(page.getByRole('heading', { name: streamName, exact: true })).toBeVisible();

        // Now actually delete for cleanup
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete Stream' }).click();
        await expect(page.getByText('Stream deleted')).toBeVisible({ timeout: 10000 });
    });
});
