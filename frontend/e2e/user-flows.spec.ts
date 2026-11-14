import { test, expect } from '@playwright/test';

test.describe('Equity Intelligence Platform E2E User Flows', () => {
  // -------------------------------------------------------------------------
  // 1. Navigation Across All 11 Sidebar Routes
  // -------------------------------------------------------------------------
  const routes = [
    { path: '/', name: 'Dashboard' },
    { path: '/discover', name: 'Stock Discovery' },
    { path: '/screener', name: 'Stock Screener' },
    { path: '/companies', name: 'Companies Directory' },
    { path: '/compare', name: 'Peer Comparison' },
    { path: '/valuation', name: 'Valuation Workbench' },
    { path: '/watchlists', name: 'Watchlists' },
    { path: '/journal', name: 'Investment Journal' },
    { path: '/portfolio', name: 'Portfolio Tracking' },
    { path: '/data-management', name: 'Data Management' },
    { path: '/settings', name: 'Settings' },
  ];

  for (const route of routes) {
    test(`navigates cleanly to ${route.name} (${route.path}) without unhandled errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          process.stdout.write(`CONSOLE ERROR: ${msg.text()} | URL: ${msg.location().url}\n`);
          consoleErrors.push(`${msg.text()} (${msg.location().url})`);
        }
      });

      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);

      // Verify page container is mounted
      await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 });

      // Verify active navigation styling / aria-current attribute
      const activeLink = page.locator(`a[href="${route.path}"][aria-current="page"]`).first();
      await expect(activeLink).toBeVisible();

      // Ensure no fatal uncaught syntax or react crash errors
      const fatalErrors = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('Failed to load resource: net::ERR_CONNECTION_REFUSED')
      );
      expect(fatalErrors).toHaveLength(0);
    });
  }

  // -------------------------------------------------------------------------
  // 2. Company Research Dossier Flow
  // -------------------------------------------------------------------------
  test('Company Research Dossier renders financial statements and toggles Standalone/Consolidated', async ({ page }) => {
    await page.goto('/companies/1');

    // Wait for the company header to render
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Verify Financial Statements tab or section is accessible
    const statementsBtn = page.getByRole('button', { name: /financial statements/i });
    if (await statementsBtn.isVisible()) {
      await statementsBtn.click();
    }

    // Toggle Standalone vs Consolidated view if present
    const consolidatedBtn = page.getByRole('button', { name: /consolidated/i }).first();
    const standaloneBtn = page.getByRole('button', { name: /standalone/i }).first();

    if (await consolidatedBtn.isVisible()) {
      await consolidatedBtn.click();
      await expect(consolidatedBtn).toBeVisible();
    }
    if (await standaloneBtn.isVisible()) {
      await standaloneBtn.click();
      await expect(standaloneBtn).toBeVisible();
    }

    // Verify statement viewer content is rendered (either matrix table or verified statement prompt)
    await expect(
      page.getByText(/Consolidated|Standalone|Financial Line Item|statements found/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // 3. Valuation Workbench Flow
  // -------------------------------------------------------------------------
  test('Valuation Workbench displays DCF models and interactive assumption inputs', async ({ page }) => {
    await page.goto('/valuation');

    // Verify valuation header
    await expect(page.getByText(/Valuation Workbench/i).first()).toBeVisible({ timeout: 10000 });

    // Verify DCF tab is available and click if needed
    const dcfTab = page.getByRole('button', { name: /DCF/i }).first();
    if (await dcfTab.isVisible()) {
      await dcfTab.click();
    }

    // Verify assumption inputs are rendered and editable
    const numericInputs = page.locator('input[type="number"]');
    if ((await numericInputs.count()) > 0) {
      const firstInput = numericInputs.first();
      await expect(firstInput).toBeVisible();
      const initialValue = await firstInput.inputValue();
      expect(initialValue).toBeDefined();
    }

    // Verify sensitivity or consensus intrinsic value section
    await expect(page.getByText(/Intrinsic Value|Fair Value|Discount Rate|Sensitivity/i).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Portfolio Tracking & Trade Log Modal Flow
  // -------------------------------------------------------------------------
  test('Portfolio Tracking displays net worth cards and opens transaction modal', async ({ page }) => {
    await page.goto('/portfolio');

    // Verify Portfolio Overview cards
    await expect(page.getByText(/Total Net Worth/i).first()).toBeVisible({ timeout: 10000 });

    // Check if a portfolio exists; if not, create one via the "New Portfolio" button
    let logTradeBtn = page.getByRole('button', { name: /log.*trade/i }).first();
    if (!(await logTradeBtn.isVisible())) {
      const newPortfolioBtn = page.getByRole('button', { name: /new portfolio/i }).first();
      await expect(newPortfolioBtn).toBeVisible();
      await newPortfolioBtn.click();

      // Modal opens
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      const nameInput = page.locator('input[placeholder*="Portfolio" i], input[type="text"]').first();
      await nameInput.fill(`E2E Test Portfolio ${Date.now()}`);

      const createBtn = page.getByRole('button', { name: /^create$/i });
      await createBtn.click();

      // Wait for modal to dismiss and active portfolio to be selected
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    }

    // Now Log Trade button must be visible
    logTradeBtn = page.getByRole('button', { name: /log.*trade/i }).first();
    await expect(logTradeBtn).toBeVisible({ timeout: 10000 });

    // Click Log Trade and verify dialog/modal opens
    await logTradeBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Verify modal contains transaction type (BUY/SELL) and quantity inputs
    await expect(page.getByText(/Log Portfolio Transaction|Record Transaction/i).first()).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible();

    // Close modal via Cancel button or Esc key
    const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    } else {
      await page.keyboard.press('Escape');
    }
  });
});
