import { test, expect } from '@playwright/test';
import {
    seedConnection,
    createStreamViaUi,
    gotoStreamDetail,
    deleteStreamViaUi,
    isLocalNatsAvailable,
    uniqueNatsName,
} from './helpers';

/**
 * End-to-end coverage for:
 *   - Message Browser (stream detail → Messages tab)
 *   - Consumer Creation Dialog (stream detail → Consumers tab)
 *
 * Requires a real NATS server on localhost:4222. The test creates its own
 * stream, publishes a JSON message to it via the Publish UI, then inspects
 * the stream detail page. A pull consumer is created and deleted as part of
 * the same flow. Finally the stream is deleted via the Radix confirm dialog.
 */
test.describe('Consumer Creation + Message Browser', () => {
    test.beforeAll(async () => {
        test.skip(!(await isLocalNatsAvailable()), 'Requires NATS on localhost:4222.');
    });

    test.beforeEach(async ({ page }) => {
        await seedConnection(page, { name: 'Real NATS' });
        await page.goto('/');
    });

    test('browse messages, create + delete a pull consumer, then clean up', async ({ page }, testInfo) => {
        const streamName = uniqueNatsName('TEST_MB', testInfo);
        const baseSubject = `${streamName}.orders`;
        const consumerName = uniqueNatsName('PULL', testInfo);

        // --- 1. Create stream ---
        await createStreamViaUi(page, streamName);

        // --- 2. Publish a JSON message to the stream's subject ---
        await page.getByRole('link', { name: 'Publish', exact: true }).click();
        await expect(page).toHaveURL(/\/publish/);
        await page.getByPlaceholder('orders.new').fill(baseSubject);
        await page.locator('textarea').fill('{"id":1,"status":"ok"}');
        await page.getByRole('button', { name: 'Publish Message' }).click();
        await expect(page.getByText('Message published')).toBeVisible({ timeout: 10000 });

        // --- 3. Navigate to stream detail (direct URL — no dropdown race) ---
        await gotoStreamDetail(page, streamName);

        // --- 4. Message Browser: load and verify the published message ---
        await page.getByRole('tab', { name: /Messages/ }).click();
        await expect(page.getByText(/Message Browser/)).toBeVisible();

        const comparisonOne = page.getByRole('tabpanel', { name: /Comparison 1/ });
        const loadBtn = comparisonOne.getByRole('button', { name: 'Load Messages' });
        await expect(loadBtn).toBeEnabled();
        await loadBtn.click();

        // First message should be visible with sequence #1 and correct subject
        await expect(comparisonOne.getByText('#1', { exact: true })).toBeVisible({ timeout: 10000 });
        await expect(comparisonOne.getByText(baseSubject, { exact: true }).first()).toBeVisible();

        // Add a second independent comparison tab, load it, then switch back.
        await page.getByRole('button', { name: /Add comparison/ }).click();
        await page.getByRole('tab', { name: 'Comparison 2' }).click();
        const comparisonTwo = page.getByRole('tabpanel', { name: /Comparison 2/ });
        await expect(comparisonTwo.getByText('Click "Load Messages" to browse stream contents.')).toBeVisible();
        await comparisonTwo.getByRole('button', { name: 'Load Messages' }).click();
        await expect(comparisonTwo.getByText('#1', { exact: true })).toBeVisible({ timeout: 10000 });
        await page.getByRole('tab', { name: 'Comparison 1' }).click();
        await expect(comparisonOne.getByText('#1', { exact: true })).toBeVisible();

        // Expand the row and assert the JSON badge + highlighted key appear
        await comparisonOne.getByText('#1', { exact: true }).click();
        await expect(comparisonOne.getByText('JSON', { exact: true })).toBeVisible();
        await expect(comparisonOne.getByText('"status"', { exact: false })).toBeVisible();

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

        // Delete the consumer — confirm dialog has no typedName
        await consumerRow.getByRole('button').last().click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete Consumer' }).click();
        await expect(page.getByText('Consumer deleted')).toBeVisible({ timeout: 10000 });

        // --- 6. Delete stream via Radix confirm dialog ---
        await deleteStreamViaUi(page, streamName);
    });

    test('cancel on confirm dialog keeps the stream alive', async ({ page }, testInfo) => {
        const streamName = uniqueNatsName('TEST_CANCEL', testInfo);

        await createStreamViaUi(page, streamName);
        await gotoStreamDetail(page, streamName);

        // Open confirm dialog then cancel
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete stream/)).toBeVisible();
        await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

        // Still on detail page, stream still exists
        await expect(page).toHaveURL(new RegExp(`\/streams\/${streamName}`));
        await expect(page.getByRole('heading', { name: streamName, exact: true })).toBeVisible();

        // Now actually delete for cleanup
        await deleteStreamViaUi(page, streamName);
    });
});
