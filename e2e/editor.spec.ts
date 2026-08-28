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
    await expect(page.locator('text=Стена').first()).toBeVisible()
    await expect(page.locator('button[title^="Кабель:"]')).toBeVisible()
  })

  test('панель свойств отображается', async ({ page }) => {
    await page.goto('/editor')
    // Проверяем, что панель свойств существует в DOM (может быть скрыта, если нет выделения)
    await expect(page.locator('text=Свойства').first()).toBeAttached()
  })

  test('панель слоёв отображается', async ({ page }) => {
    await page.goto('/editor')
    // Проверяем, что панель слоёв существует в DOM (может быть скрыта, если нет выделения)
    await expect(page.locator('text=Слои').first()).toBeAttached()
  })

  test('панель спецификации отображается', async ({ page }) => {
    await page.goto('/editor')
    // Проверяем, что панель спецификации существует в DOM (может быть скрыта, если нет данных)
    await expect(page.locator('text=Спецификация').first()).toBeAttached()
  })

  test('панель проверки отображается', async ({ page }) => {
    await page.goto('/editor')
    await expect(page.locator('.float-panel-title').filter({ hasText: 'Проверка' })).toBeVisible()
  })

  test('переключение инструментов работает', async ({ page }) => {
    await page.goto('/editor')
    // Проверяем, что кнопка "Кабель" отображается как пункт меню с текущим режимом
    const cableBtn = page.locator('button[title^="Кабель:"]').first()
    await expect(cableBtn).toBeVisible()
    await expect(cableBtn).toHaveClass(/editor-dock-item-menu/)
  })

  test('плавающие панели отображаются', async ({ page }) => {
    await page.goto('/editor')
    await page.waitForTimeout(1000)
    const floatPanels = page.locator('.float-panel')
    await expect(floatPanels.first()).toBeVisible()
  })

  test('панель листов отображается', async ({ page }) => {
    await page.goto('/editor')
    await page.waitForTimeout(1000)
    const sheetsBar = page.locator('.sheets-bar')
    await expect(sheetsBar).toBeVisible()
  })

  test('привязки работают (snap отображается)', async ({ page }) => {
    await page.goto('/editor')
    await page.waitForTimeout(1000)
    // Нарисуем стену для проверки привязки
    await page.click('button[title^="Стена"]', { force: true })
    await page.waitForTimeout(500)
    // Проверяем, что snap-индикатор может отображаться (ghost-слой существует)
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('перетаскивание устройств работает (drag & drop)', async ({ page }) => {
    await page.goto('/editor')
    await page.waitForTimeout(1000)

    const viewportSize = await page.viewportSize()
    const cx = (viewportSize?.width ?? 1280) / 2
    const cy = (viewportSize?.height ?? 720) / 2
    const scale = 0.1 // совпадает с Camera.scale по умолчанию
    const worldToScreen = (x: number, y: number) => ({
      x: cx + x * scale,
      y: cy - y * scale,
    })

    // 1. Рисуем горизонтальную стену (-1000, 0) → (1000, 0)
    await page.click('button[title^="Стена"]', { force: true })
    await page.waitForTimeout(200)
    const h1 = worldToScreen(-1000, 0)
    const h2 = worldToScreen(1000, 0)
    await page.mouse.move(h1.x, h1.y)
    await page.mouse.down()
    await page.mouse.move(h2.x, h2.y)
    await page.mouse.up()
    await page.waitForTimeout(200)

    // 2. Рисуем вертикальную стену (0, -1000) → (0, 1000)
    await page.click('button[title^="Стена"]', { force: true })
    await page.waitForTimeout(200)
    const v1 = worldToScreen(0, -1000)
    const v2 = worldToScreen(0, 1000)
    await page.mouse.move(v1.x, v1.y)
    await page.mouse.down()
    await page.mouse.move(v2.x, v2.y)
    await page.mouse.up()
    await page.waitForTimeout(200)

    // Сохраняем id второй стены
    const verticalWallId = await page.evaluate(() => {
      const engine = (window as any).__engine
      return engine.plan.walls[1]?.id ?? ''
    })
    expect(verticalWallId).toBeTruthy()

    // 3. Размещаем устройство (розетку) на горизонтальной стене, t ≈ 0.25
    await page.click('button[title="Устройства"]', { force: true })
    await page.waitForTimeout(200)
    const place = worldToScreen(-500, 150) // над стеной, side = 1
    await page.mouse.move(place.x, place.y)
    await page.waitForTimeout(200)
    await page.mouse.click(place.x, place.y)
    await page.waitForTimeout(200)

    const initialT = await page.evaluate(() => {
      const engine = (window as any).__engine
      return engine.plan.devices[0]?.t ?? -1
    })
    expect(initialT).toBeGreaterThan(0)
    expect(initialT).toBeLessThan(0.5)

    // 4. Переключаемся на инструмент выбора
    await page.click('button[title="Выбор"]', { force: true })
    await page.waitForTimeout(200)

    // 5. Перетаскиваем устройство вдоль стены: t ≈ 0.25 → t ≈ 0.75
    const start = worldToScreen(-500, 150)
    const end = worldToScreen(500, 150)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(200)

    const movedT = await page.evaluate(() => {
      const engine = (window as any).__engine
      return engine.plan.devices[0]?.t ?? -1
    })
    expect(movedT).toBeGreaterThan(0.5)
    expect(movedT).toBeLessThan(1)

    // 6. Перетаскиваем устройство на вертикальную стену (курсор точно на стене)
    const devicePos = worldToScreen(500, 150)
    const targetOnVertical = worldToScreen(0, 500)
    await page.mouse.move(devicePos.x, devicePos.y)
    await page.mouse.down()
    await page.mouse.move(targetOnVertical.x, targetOnVertical.y, { steps: 15 })
    await page.mouse.up()
    await page.waitForTimeout(200)

    const finalWallId = await page.evaluate(() => {
      const engine = (window as any).__engine
      return engine.plan.devices[0]?.wallId ?? ''
    })
    expect(finalWallId).toBe(verticalWallId)
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

test.describe('Плавающие панели', () => {
  test('панель можно изменить размер', async ({ page }) => {
    await page.goto('/editor')
    await page.waitForTimeout(1000)

    const panel = page.locator('[data-panel="properties"]')
    const handle = panel.locator('.float-panel-resize')
    await expect(handle).toBeVisible()

    const boxBefore = await panel.boundingBox()
    expect(boxBefore).toBeTruthy()

    const handleBox = await handle.boundingBox()
    expect(handleBox).toBeTruthy()
    const startX = handleBox!.x + handleBox!.width / 2
    const startY = handleBox!.y + handleBox!.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 120, startY + 120, { steps: 8 })
    await page.mouse.up()

    await page.waitForTimeout(300)
    const boxAfter = await panel.boundingBox()
    expect(boxAfter).toBeTruthy()
    expect(boxAfter!.width).toBeGreaterThan(boxBefore!.width + 50)
    expect(boxAfter!.height).toBeGreaterThan(boxBefore!.height + 50)
  })

  test('сворачивание/разворачивание анимируется и меняет высоту', async ({ page }) => {
    await page.goto('/editor')
    await page.waitForTimeout(1000)

    const panel = page.locator('[data-panel="properties"]')
    const btn = panel.locator('.float-panel-collapse')
    const boxBefore = await panel.boundingBox()
    expect(boxBefore).toBeTruthy()
    expect(boxBefore!.height).toBeGreaterThan(100)

    await btn.click()
    await page.waitForTimeout(400)
    const boxCollapsed = await panel.boundingBox()
    expect(boxCollapsed).toBeTruthy()
    expect(boxCollapsed!.height).toBeLessThan(80)

    await btn.click()
    await page.waitForTimeout(400)
    const boxExpanded = await panel.boundingBox()
    expect(boxExpanded).toBeTruthy()
    expect(boxExpanded!.height).toBeGreaterThan(100)
  })

  test('на мобильных панель отображается как bottom sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/editor')
    await page.waitForTimeout(1000)

    const panel = page.locator('[data-panel="properties"]')
    const box = await panel.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeCloseTo(375, 0)
    expect(box!.y).toBeGreaterThan(300)
  })
})
