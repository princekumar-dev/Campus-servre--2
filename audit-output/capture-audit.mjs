import { chromium } from 'file:///C:/tmp/campusserve-audit-pw/node_modules/playwright/index.mjs'
import fs from 'fs/promises'

const base = 'http://localhost:4173'
const out = new URL('./', import.meta.url).pathname.slice(1)
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const authCache = new Map()

async function capture(name, route, account, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewportSize: viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  if (account) {
    let result = authCache.get(account)
    if (!result) {
      const response = await context.request.post(`${base}/api/auth`, { data: { email: account, password: '123' } })
      result = await response.json()
      authCache.set(account, result)
    }
    if (!result.success) throw new Error(`Login failed for ${account}: ${result.error}`)
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user }) => {
      const auth = { isAuthenticated: true, token, id: user.id, email: user.email, name: user.name, role: user.role, department: user.department, phoneNumber: user.phoneNumber, eSignature: user.eSignature }
      localStorage.setItem('auth', JSON.stringify(auth))
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('userRole', user.role)
      localStorage.setItem('userId', user.id)
    }, result)
  }
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true })
  await fs.writeFile(`${out}${name}.txt`, `url=${page.url()}\ntitle=${await page.title()}\nbody=${(await page.locator('body').innerText()).slice(0, 5000)}`)
  await context.close()
}

await capture('01-login', '/login')
await capture('02-requester-dashboard', '/dashboard', 'hod.cse@msec.edu.in')
await capture('03-manager-dashboard', '/dashboard', 'manager@msec.edu.in')
await capture('04-manager-quotations', '/quotations', 'manager@msec.edu.in')
await capture('05-gate-dashboard', '/gate/dashboard', 'super@msec.edu.in')
await capture('06-service-dashboard', '/service/dashboard', 'service@msec.edu.in')
await capture('07-accounts-dashboard', '/accounts/dashboard', 'super@msec.edu.in')
await capture('08-admin-users', '/admin/users', 'super@msec.edu.in')
await capture('09-mobile-requests', '/requests', 'manager@msec.edu.in', { width: 390, height: 844 })

await browser.close()
