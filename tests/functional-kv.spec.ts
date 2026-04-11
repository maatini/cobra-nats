import { test, expect } from '@playwright/test';

test.describe('Functional KV Stores', () => {
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

    test('should manage a KV Bucket and Keys', async ({ page }) => {
        const bucketName = `TEST_BUCKET_${Date.now()}`;
        const testKey = 'test.key.1';
        const testValue = '{"message":"hello world"}';

        // Navigate directly — sidebar soft-nav has been flaky here when
        // hydration races with the route transition.
        await page.goto('/kv');
        await expect(page.getByRole('heading', { name: 'KeyValue Stores' })).toBeVisible();

        // Wait for the search input — it only renders on the success branch of
        // the page's loading ternary, so it's a reliable "page stable" signal.
        await expect(page.getByPlaceholder('Search buckets...')).toBeVisible({ timeout: 10000 });

        // Open create dialog
        await page.getByRole('button', { name: 'Create KV Bucket' }).click();

        // Fill form
        await page.getByLabel('Bucket Name').fill(bucketName);
        await page.getByLabel('Description').fill('A test bucket');

        // Submit
        const submitButton = page.locator('button[type="submit"]', { hasText: 'Create Bucket' });
        await expect(submitButton).toBeEnabled();
        await submitButton.click();

        // Wait for EITHER success or failure toast
        const createSuccessToast = page.getByText(`KV Bucket "${bucketName}" created successfully`);
        const errorToast = page.getByText('Failed to create bucket');

        await Promise.race([
            createSuccessToast.waitFor({ state: 'visible', timeout: 15000 }),
            errorToast.waitFor({ state: 'visible', timeout: 15000 })
        ]).catch(() => {
            throw new Error('Timed out waiting for success or error toast');
        });

        if (await errorToast.isVisible()) {
            const description = await page.locator('[data-sonner-toast] [data-description]').innerText().catch(() => 'No description found');
            throw new Error(`Bucket creation failed: ${description}`);
        }

        await expect(createSuccessToast).toBeVisible();

        // Navigate to the created bucket (the card title should have the bucket name)
        await expect(page.getByText('Loading KV buckets...')).not.toBeVisible({ timeout: 10000 });

        // Filter explicitly to make sure it's the only one 
        await page.getByPlaceholder('Search buckets...').fill(bucketName);

        // Using locator securely to find the link to the detail view
        const bucketLink = page.locator(`a[href="/kv/${bucketName}"]`);
        await bucketLink.click();

        // Check if we navigated to the bucket detail view
        await expect(page).toHaveURL(new RegExp(`\/kv\/${bucketName}`));

        // Add a Key
        await page.getByRole('button', { name: 'Add Entry' }).click();
        await page.getByLabel('Key').fill(testKey);
        // Fill the Monaco Editor or textarea - using the standard locator strategy for the textarea
        await page.getByLabel('Value').fill(testValue);

        await page.getByRole('button', { name: 'Save Entry' }).click();

        // Wait for key creation success or error
        const keySuccessToast = page.getByText(`Key "${testKey}" saved`);
        const keyErrorToast = page.getByText(/Failed to save entry/);

        await Promise.race([
            keySuccessToast.waitFor({ state: 'visible', timeout: 10000 }),
            keyErrorToast.waitFor({ state: 'visible', timeout: 10000 })
        ]).catch(() => {
            throw new Error('Timed out waiting for KV entry save result');
        });

        if (await keyErrorToast.isVisible()) {
            throw new Error(`Failed to save KV entry: ${await keyErrorToast.innerText()}`);
        }
        await expect(keySuccessToast).toBeVisible();

        // Verify key appears in the list and can be clicked
        const keyRow = page.getByText(testKey, { exact: true });
        await expect(keyRow).toBeVisible({ timeout: 10000 });
        await keyRow.click();

        // Verify value is displayed correctly in the editor view (simplified check)
        await expect(page.getByText('Viewing Key', { exact: true })).toBeVisible();

        // The saved payload is valid JSON, so the JsonViewer should render a JSON badge
        // and highlight the "message" key. Locate inside the value editor region.
        await expect(page.getByText('JSON', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('"message"', { exact: false })).toBeVisible();

        // Delete Bucket — Radix confirm dialog replaces window.confirm.
        await page.getByRole('button', { name: 'Delete Bucket' }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete bucket/)).toBeVisible();
        await confirmDialog.getByRole('button', { name: 'Delete Bucket' }).click();

        // Wait for successful deletion and redirection
        const deleteSuccessToast = page.getByText('Bucket deleted');
        await expect(deleteSuccessToast).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveURL(/\/kv/);
    });
});
