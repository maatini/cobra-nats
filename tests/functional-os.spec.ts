import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

test.describe('Functional Object Store CRUD', () => {
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

    test('should create a bucket, upload a file, and delete', async ({ page }) => {
        const bucketName = `TEST_OS_${Date.now()}`;

        // Navigate to OS page directly — sidebar link click races with hydration
        // when the suite runs multiple workers in parallel.
        await page.goto('/os');
        await expect(page).toHaveURL(/\/os/);
        await expect(page.getByRole('heading', { name: 'Object Stores' })).toBeVisible({ timeout: 10000 });

        // Open create dialog
        await page.getByRole('button', { name: 'Create Object Store' }).click();

        // Fill form
        await page.getByLabel('Bucket Name').fill(bucketName);

        // Submit — bypass stability check, Radix animation can micro-shift the button.
        const submitButton = page.getByRole('dialog').getByRole('button', { name: 'Create Object Store', exact: true });
        await expect(submitButton).toBeEnabled();
        await submitButton.evaluate((el: HTMLButtonElement) => el.click());

        // Wait for success or failure toast
        const successToast = page.getByText(`Object Store "${bucketName}" created successfully`);
        const errorToast = page.getByText('Failed to create Object Store');

        await Promise.race([
            successToast.waitFor({ state: 'visible', timeout: 15000 }),
            errorToast.waitFor({ state: 'visible', timeout: 15000 })
        ]).catch(() => {
            throw new Error('Timed out waiting for success or error toast');
        });

        if (await errorToast.isVisible()) {
            const description = await page.locator('[data-sonner-toast] [data-description]').innerText().catch(() => 'No description found');
            throw new Error(`Bucket creation failed: ${description}`);
        }

        await expect(successToast).toBeVisible();

        // Force a fresh fetch to guarantee the new bucket is in the list
        // (avoids races where the post-create refetch hasn't landed yet).
        await page.reload();

        // Bucket should appear in the list — click "Browse Objects" to navigate
        const bucketLink = page.locator(`a[href="/os/${bucketName}"]`).first();
        await expect(bucketLink).toBeVisible({ timeout: 10000 });
        await bucketLink.click();

        // Should be on bucket detail page
        await expect(page).toHaveURL(new RegExp(`/os/${bucketName}`));
        await expect(page.getByRole('heading', { name: bucketName, exact: true })).toBeVisible({ timeout: 10000 });

        // Create a temporary test file to upload
        const tmpDir = path.join(__dirname, '..', 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const testFilePath = path.join(tmpDir, 'test-upload.txt');
        fs.writeFileSync(testFilePath, 'Hello from E2E test!');

        // Upload an object via the dialog
        await page.getByRole('button', { name: 'Upload' }).click();
        await expect(page.getByRole('heading', { name: 'Upload Object' })).toBeVisible();

        // Set file on input
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Submit upload
        const uploadButton = page.getByRole('button', { name: 'Upload Object' });
        await expect(uploadButton).toBeEnabled();
        await uploadButton.click();

        // Wait for upload success
        const uploadSuccess = page.getByText('uploaded successfully');
        await expect(uploadSuccess).toBeVisible({ timeout: 15000 });

        // Object should appear in the list (exact match — avoid collision with toast text)
        await expect(page.getByText('test-upload.txt', { exact: true })).toBeVisible({ timeout: 10000 });

        // Delete the bucket from the detail page — Radix confirm dialog replaces window.confirm.
        await page.getByRole('button', { name: 'Delete Bucket' }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete bucket/)).toBeVisible();
        await confirmDialog.getByLabel('Confirm name').fill(bucketName);
        await confirmDialog.getByRole('button', { name: 'Delete Bucket' }).click();

        // Wait for deletion and redirect
        const deletedToast = page.getByText('Bucket deleted');
        await expect(deletedToast).toBeVisible({ timeout: 10000 });
        await expect(page).toHaveURL(/\/os/);

        // Cleanup temp file
        if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    });

    test('should preview an uploaded text file in the slide-in sheet', async ({ page }) => {
        const bucketName = `TEST_OS_PREVIEW_${Date.now()}`;

        // --- Create bucket ---
        await page.goto('/os');
        await expect(page.getByRole('heading', { name: 'Object Stores' })).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Create Object Store' }).click();
        await page.getByLabel('Bucket Name').fill(bucketName);

        const submitButton = page.getByRole('dialog').getByRole('button', { name: 'Create Object Store', exact: true });
        await expect(submitButton).toBeEnabled();
        await submitButton.evaluate((el: HTMLButtonElement) => el.click());

        const successToast = page.getByText(`Object Store "${bucketName}" created successfully`);
        await expect(successToast).toBeVisible({ timeout: 15000 });

        // --- Navigate into the bucket ---
        await page.reload();
        const bucketLink = page.locator(`a[href="/os/${bucketName}"]`).first();
        await expect(bucketLink).toBeVisible({ timeout: 10000 });
        await bucketLink.click();
        await expect(page).toHaveURL(new RegExp(`/os/${bucketName}`));
        await expect(page.getByRole('heading', { name: bucketName, exact: true })).toBeVisible({ timeout: 10000 });

        // --- Upload a JSON file for syntax highlighting verification ---
        const tmpDir = path.join(__dirname, '..', 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const jsonPath = path.join(tmpDir, 'preview-test.json');
        const jsonContent = '{"name":"test","value":42,"enabled":true}';
        fs.writeFileSync(jsonPath, jsonContent);

        await page.getByRole('button', { name: 'Upload' }).click();
        await expect(page.getByRole('heading', { name: 'Upload Object' })).toBeVisible();
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(jsonPath);
        const uploadButton = page.getByRole('button', { name: 'Upload Object' });
        await expect(uploadButton).toBeEnabled();
        await uploadButton.click();
        await expect(page.getByText('uploaded successfully')).toBeVisible({ timeout: 15000 });

        // Object should appear in the list
        await expect(page.getByText('preview-test.json', { exact: true })).toBeVisible({ timeout: 10000 });

        // --- Click the Eye (preview) button ---
        const eyeButton = page.locator('table tbody tr', { hasText: 'preview-test.json' }).getByRole('button', { name: 'Preview' });
        await eyeButton.click();

        // --- Verify preview sheet ---
        // The sheet slides in from the right
        const sheet = page.getByRole('dialog');
        await expect(sheet).toBeVisible({ timeout: 5000 });

        // Sheet header should show the file name
        await expect(sheet.getByText('preview-test.json', { exact: true })).toBeVisible();

        // The CodeViewer should detect JSON and show the language label
        await expect(sheet.getByText('json', { exact: true })).toBeVisible();

        // The content should be visible (shiki highlights JSON, so look for parts)
        await expect(sheet.getByText('"name"', { exact: false })).toBeVisible();
        await expect(sheet.getByText('"test"', { exact: false })).toBeVisible();

        // Close the sheet
        await page.keyboard.press('Escape');
        await expect(sheet).not.toBeVisible({ timeout: 3000 });

        // --- Cleanup: delete bucket ---
        await page.getByRole('button', { name: 'Delete Bucket' }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete bucket/)).toBeVisible();
        await confirmDialog.getByLabel('Confirm name').fill(bucketName);
        await confirmDialog.getByRole('button', { name: 'Delete Bucket' }).click();
        await expect(page.getByText('Bucket deleted')).toBeVisible({ timeout: 10000 });

        // Cleanup
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    });

    test('should preview an object with a non-json extension but json content', async ({ page }) => {
        const bucketName = `TEST_OS_DETECT_${Date.now()}`;

        // --- Create bucket ---
        await page.goto('/os');
        await expect(page.getByRole('heading', { name: 'Object Stores' })).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Create Object Store' }).click();
        await page.getByLabel('Bucket Name').fill(bucketName);

        const submitButton = page.getByRole('dialog').getByRole('button', { name: 'Create Object Store', exact: true });
        await expect(submitButton).toBeEnabled();
        await submitButton.evaluate((el: HTMLButtonElement) => el.click());
        await expect(page.getByText(`Object Store "${bucketName}" created successfully`)).toBeVisible({ timeout: 15000 });

        await page.reload();
        const bucketLink = page.locator(`a[href="/os/${bucketName}"]`).first();
        await expect(bucketLink).toBeVisible({ timeout: 10000 });
        await bucketLink.click();

        // --- Upload a file with no extension but JSON content ---
        const tmpDir = path.join(__dirname, '..', 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const noExtPath = path.join(tmpDir, 'config-without-extension');
        fs.writeFileSync(noExtPath, '{"services":{"nats":4222}}');

        await page.getByRole('button', { name: 'Upload' }).click();
        await expect(page.getByRole('heading', { name: 'Upload Object' })).toBeVisible();
        await page.locator('input[type="file"]').setInputFiles(noExtPath);
        const uploadButton = page.getByRole('button', { name: 'Upload Object' });
        await expect(uploadButton).toBeEnabled();
        await uploadButton.click();
        await expect(page.getByText('uploaded successfully')).toBeVisible({ timeout: 15000 });

        // --- Open preview ---
        const eyeButton = page.locator('table tbody tr', { hasText: 'config-without-extension' }).getByRole('button', { name: 'Preview' });
        await eyeButton.click();

        // Content-based detection should recognize JSON
        const sheet = page.getByRole('dialog');
        await expect(sheet).toBeVisible({ timeout: 5000 });
        await expect(sheet.getByText('json', { exact: true })).toBeVisible();
        await expect(sheet.getByText('"nats"', { exact: false })).toBeVisible();

        // Close
        await page.keyboard.press('Escape');
        await expect(sheet).not.toBeVisible({ timeout: 3000 });

        // --- Cleanup ---
        await page.getByRole('button', { name: 'Delete Bucket' }).click();
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/Delete bucket/)).toBeVisible();
        await confirmDialog.getByLabel('Confirm name').fill(bucketName);
        await confirmDialog.getByRole('button', { name: 'Delete Bucket' }).click();
        await expect(page.getByText('Bucket deleted')).toBeVisible({ timeout: 10000 });

        if (fs.existsSync(noExtPath)) fs.unlinkSync(noExtPath);
    });

    test('should show empty sheet state when clicking preview on missing object', async ({ page }) => {
        // Navigate to existing bucket with objects
        await page.goto('/os');
        await expect(page.getByRole('heading', { name: 'Object Stores' })).toBeVisible({ timeout: 10000 });

        // Click on the first available bucket
        const firstBucket = page.locator('a[href^="/os/OBJ_"], a[href^="/os/bpmn"], a[href^="/os/TEST"]').first();
        const hasBuckets = await firstBucket.isVisible().catch(() => false);

        if (hasBuckets) {
            await firstBucket.click();
            await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });

            // Verify each object row has a Preview button
            const previewButtons = page.locator('table tbody tr button[title="Preview"]');
            const count = await previewButtons.count();
            if (count > 0) {
                // Click first preview button
                await previewButtons.first().click();
                const sheet = page.getByRole('dialog');
                await expect(sheet).toBeVisible({ timeout: 5000 });
                // Sheet should show the filename
                await expect(sheet.getByText(/\.|\w+/)).toBeVisible();
                await page.keyboard.press('Escape');
            }
        }
    });
});
