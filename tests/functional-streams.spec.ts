import { test, expect } from '@playwright/test';

test.describe('Functional Stream Creation', () => {
    test.beforeEach(async ({ page }) => {
        // Setup a connection in localStorage
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

    test('should create a stream and verify it exists', async ({ page }) => {
        const streamName = `TEST_STREAM_${Date.now()}`;

        await page.getByRole('link', { name: 'Streams', exact: true }).click();
        await expect(page).toHaveURL(/\/streams/);

        // Open create dialog
        await page.getByRole('button', { name: 'Create Stream' }).click();

        // Fill form
        await page.getByLabel('Stream Name').fill(streamName);
        await page.getByLabel('Subjects').fill(`${streamName}.>`);

        // Submit — scope to the dialog to avoid collisions with the page-level trigger.
        // Use DOM click() to bypass Playwright's stability checks: the Radix dialog
        // may micro-shift the button during its open animation.
        const submitButton = page.getByRole('dialog').getByRole('button', { name: 'Create Stream', exact: true });
        await expect(submitButton).toBeEnabled();
        await submitButton.evaluate((el: HTMLButtonElement) => el.click());

        // Wait for EITHER success or failure toast
        const successToast = page.getByText(`Stream "${streamName}" created successfully`);
        const errorToast = page.getByText('Failed to create stream');

        await Promise.race([
            successToast.waitFor({ state: 'visible', timeout: 15000 }),
            errorToast.waitFor({ state: 'visible', timeout: 15000 })
        ]).catch(() => {
            throw new Error('Timed out waiting for success or error toast');
        });

        if (await errorToast.isVisible()) {
            const description = await page.locator('[data-sonner-toast] [data-description]').innerText().catch(() => 'No description found');
            throw new Error(`Stream creation failed: ${description}`);
        }

        await expect(successToast).toBeVisible();

        // Force a fresh fetch to guarantee the new stream is in the table
        // (avoids races where the post-create refetch hasn't landed yet).
        await page.reload();
        await expect(page.getByText('Loading streams...')).not.toBeVisible({ timeout: 10000 });

        // Filter the table using the search box (vital if there are many streams paginated)
        await page.getByPlaceholder('Search streams...').fill(streamName);

        // Use getByText for the stream name in the table and click it to view details
        const streamRow = page.getByText(streamName, { exact: true });
        await expect(streamRow).toBeVisible({ timeout: 10000 });

        // Find the row containing the stream name and open the actions menu
        const row = page.locator('tr', { hasText: streamName });
        await row.getByRole('button', { name: 'Open menu' }).click();

        // Wait for dropdown animation to complete before clicking menu item
        const viewDetailsItem = page.getByRole('menuitem', { name: 'View Details' });
        await expect(viewDetailsItem).toBeVisible({ timeout: 5000 });
        await viewDetailsItem.click();

        // Wait for details page to load
        await expect(page).toHaveURL(new RegExp(`\/streams\/${streamName}`));
        await expect(page.getByRole('heading', { name: streamName, exact: true })).toBeVisible({ timeout: 10000 });

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
        // Assert via the Load Messages button which is unique to this view.
        await expect(page.getByRole('button', { name: 'Load Messages' })).toBeVisible();
        await expect(page.getByText(/Message Browser/)).toBeVisible();

        await infoTab.click();

        // Delete the stream from the details page — Radix confirm dialog replaces window.confirm.
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete stream/)).toBeVisible();
        await confirmDialog.getByRole('button', { name: 'Delete Stream' }).click();

        // Wait for successful deletion toast and redirect back to streams list
        const deleteSuccessToast = page.getByText('Stream deleted');
        await expect(deleteSuccessToast).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveURL(/\/streams/);

        // Ensure stream is not in the list anymore
        await expect(page.getByText(streamName, { exact: true })).not.toBeVisible();
    });
});
