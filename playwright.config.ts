import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry to absorb Next.js on-demand route compilation flakes. */
    retries: process.env.CI ? 2 : 1,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:3000',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Use devbox chromium when available (set via init_hook),
                // otherwise fall back to Playwright's managed binary.
                ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
                    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
                } : {}),
            },
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                // Use devbox firefox when available (set via init_hook).
                ...(process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH ? {
                    executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH,
                } : {}),
            },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});
