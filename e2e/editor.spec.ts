import { test, expect } from '@playwright/test'

test.describe('InvoltCAD Editor', () => {
  test('главная страница загружается', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/InvoltCAD/)
    await expect(page.locator('h1')).toContainText('InvoltCAD')
  })

  test('редактор загружается', async ({ page }) => {
    await page.goto('/editor')
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Стена')).toBeVisible()
    await expect(page.locator('text=Дверь')).toBeVisible()
    await expect(page.locator('text=Окно')).toBeVisible()
  })

  test('панель свойств отображается', async ({ page }) => {
    await page.goto('/editor')
    await expect(page.locator('text=Свойства')).toBeVisible()
  })

  test('панель слоёв отображается', async ({ page }) => {
    await page.goto('/editor')
    await expect(page.locator('text=Слои')).toBeVisible()
  })

  test('панель спецификации отображается', async ({ page }) => {
    await page.goto('/editor')
    await expect(page.locator('text=Спецификация')).toBeVisible()
  })

  test('панель проверки отображается', async ({ page }) => {
    await page.goto('/editor')
    await expect(page.locator('text=Проверка')).toBeVisible()
  })

  test('переключение инструментов работает', async ({ page }) => {
    await page.goto('/editor')
    await page.click('text=Дверь')
    await expect(page.locator('button:has-text("Дверь")').first()).toHaveClass(/border-orange-500/)
    await page.click('text=Стена')
    await expect(page.locator('button:has-text("Стена")').first()).toHaveClass(/border-orange-500/)
  })
})

test.describe('Авторизация', () => {
  test('страница входа загружается', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Вход в InvoltCAD')).toBeVisible()
    await expect(page.locator('text=Войти через Google')).toBeVisible()
  })
})

test.describe('Маркетплейс', () => {
  test('страница маркетплейса загружается', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page.locator('text=Маркетплейс')).toBeVisible()
  })
})

test.describe('Тарифы', () => {
  test('страница тарифов загружается', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('text=Тарифы InvoltCAD')).toBeVisible()
    await expect(page.locator('text=Бесплатный')).toBeVisible()
    await expect(page.locator('text=Pro')).toBeVisible()
    await expect(page.locator('text=Business')).toBeVisible()
  })
})
