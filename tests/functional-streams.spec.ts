import { test, expect } from '@playwright/test';
import {
    seedConnection,
    createStreamViaUi,
    expectStreamInList,
    gotoStreamDetail,
    deleteStreamViaUi,
} from './helpers';

test.describe('Functional Stream Creation', () => {
    test.beforeEach(async ({ page }) => {
        await seedConnection(page, { name: 'Real NATS' });
        await page.goto('/');
    });

    test('should create a stream and verify it exists', async ({ page }) => {
        const streamName = `TEST_STREAM_${Date.now()}`;

        await createStreamViaUi(page, streamName);
        await expectStreamInList(page, streamName);

        // Direct navigation avoids flaky Radix "View Details" dropdown under load.
        await gotoStreamDetail(page, streamName);

        // Verify tabs are present and switch between them
        const infoTab = page.getByRole('tab', { name: 'Info', exact: true });
        const consumersTab = page.getByRole('tab', { name: /Consumers.*/, exact: false });
        const messagesTab = page.getByRole('tab', { name: /Messages.*/, exact: false });

        await expect(infoTab).toBeVisible();
        await expect(consumersTab).toBeVisible();
        await expect(messagesTab).toBeVisible();

        await consumersTab.click();
        await expect(page.getByRole('heading', { name: 'Processing Consumers', exact: true })).toBeVisible();

        await messagesTab.click();
        // Message Browser is rendered inside a shadcn CardTitle (div) — not a heading role.
        await expect(page.getByRole('button', { name: 'Load Messages' })).toBeVisible();
        await expect(page.getByText(/Message Browser/)).toBeVisible();

        await infoTab.click();

        await deleteStreamViaUi(page, streamName);

        // Ensure stream is not in the table anymore (scope to table to avoid
        // breadcrumb/h1 matches when page hasn't finished re-rendering).
        await expect(page.getByRole('heading', { name: 'JetStream Streams' })).toBeVisible();
        await expect(page.locator('table').getByText(streamName, { exact: true })).not.toBeVisible();
    });

    test('should show create dialog defaults and accept a max age unit', async ({ page }) => {
        await page.goto('/streams');
        await expect(
            page.getByRole('button', { name: 'Create Stream', exact: true })
        ).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Create Stream', exact: true }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('Create New Stream')).toBeVisible();

        // Defaults from StreamFormValues: unlimited messages, no max age (Hours unit).
        await expect(dialog.getByLabel('Max Messages')).toHaveValue('-1');
        await expect(dialog.getByLabel('Max Age')).toHaveValue('0');
        await expect(dialog.getByLabel('Unit')).toContainText('Hours');
        await expect(
            dialog.getByRole('button', { name: 'Create Stream', exact: true })
        ).toBeEnabled();

        // Unit is a Radix Select (rendered in a portal) — switch it to Days.
        await dialog.getByLabel('Max Age').fill('7');
        await dialog.getByLabel('Unit').click();
        await page.getByRole('option', { name: 'Days' }).click();
        await expect(dialog.getByLabel('Max Age')).toHaveValue('7');
        await expect(dialog.getByLabel('Unit')).toContainText('Days');
        await expect(
            dialog.getByRole('button', { name: 'Create Stream', exact: true })
        ).toBeEnabled();
    });
});
