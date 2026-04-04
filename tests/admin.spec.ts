import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'password'

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.fill('#password', ADMIN_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL('/admin')
}

// ─── Login ────────────────────────────────────────────────────────────────────

test('admin login with wrong password shows error', async ({ page }) => {
  await page.goto('/admin/login')
  await page.fill('#password', 'wrong')
  await page.click('button[type=submit]')
  await expect(page.getByText('Invalid password')).toBeVisible()
  expect(page.url()).toContain('/admin/login')
})

test('admin login with correct password redirects to dashboard', async ({ page }) => {
  await login(page)
  await expect(page.getByText('Photo Station Admin')).toBeVisible()
})

test('admin pages redirect to login when unauthenticated', async ({ page }) => {
  await page.goto('/admin/sessions')
  await page.waitForURL('**/admin/login')
  expect(page.url()).toContain('/admin/login')
})

// ─── Sessions ─────────────────────────────────────────────────────────────────

test('create a session and see it in the list', async ({ page }) => {
  await login(page)
  await page.goto('/admin/sessions')

  const label = `Test Family ${Date.now()}`
  await page.fill('input[placeholder*="Smith Family"]', label)
  await page.click('button:has-text("Create")')

  await expect(page.getByText(label)).toBeVisible()
})

test('select all checkbox selects every session', async ({ page }) => {
  await login(page)
  await page.goto('/admin/sessions')
  await page.waitForSelector('.divide-y')

  const selectAll = page.locator('input[type=checkbox]').first()
  await selectAll.check()

  const actionBar = page.getByText(/session\(s\) selected/)
  await expect(actionBar).toBeVisible()
})

test('delete a session removes it from list', async ({ page }) => {
  await login(page)
  await page.goto('/admin/sessions')

  const label = `Delete Me ${Date.now()}`
  await page.fill('input[placeholder*="Smith Family"]', label)
  await page.click('button:has-text("Create")')
  await expect(page.getByText(label)).toBeVisible()

  // Select and delete via bulk action
  const row = page.locator('.divide-y > div').filter({ hasText: label })
  await row.locator('input[type=checkbox]').check()
  page.once('dialog', (d) => d.accept())
  await page.click('button:has-text("Delete Selected")')
  await expect(page.locator('.divide-y p.font-medium').filter({ hasText: label })).not.toBeAttached()
})

// ─── Print / PDF ──────────────────────────────────────────────────────────────

test('print QR cards — generates non-empty PDF', async ({ page }) => {
  await login(page)
  await page.goto('/admin/sessions')

  // Ensure at least one session exists
  const label = `Print Test ${Date.now()}`
  await page.fill('input[placeholder*="Smith Family"]', label)
  await page.click('button:has-text("Create")')
  await expect(page.getByText(label)).toBeVisible()

  // Select that session
  const row = page.locator('.divide-y > div').filter({ hasText: label })
  await row.locator('input[type=checkbox]').check()
  await expect(page.getByText(/session\(s\) selected/)).toBeVisible()

  // Use Playwright's built-in PDF generation (uses Chromium print engine)
  const pdfPath = path.join(__dirname, 'print-output.pdf')
  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
  })

  fs.writeFileSync(pdfPath, pdfBuffer)

  // PDF must be non-trivially sized (a blank page is ~1-2KB, a real card is much more)
  const stats = fs.statSync(pdfPath)
  expect(stats.size).toBeGreaterThan(10_000)

  console.log(`✓ PDF saved to ${pdfPath} (${Math.round(stats.size / 1024)}KB)`)
})

// ─── Register page ────────────────────────────────────────────────────────────

test('register page without uid shows invalid QR code', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByText('Invalid QR Code')).toBeVisible()
})

test('home page loads and shows Admin Login link', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Photo Station')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin Login' })).toBeVisible()
})
