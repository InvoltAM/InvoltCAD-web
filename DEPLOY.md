# Деплой InvoltCAD Web

## Vercel (рекомендуется)

1. Подключите репозиторий `InvoltAM/InvoltCAD-web` к Vercel.
2. Настройте переменные окружения в Vercel Dashboard:
   - `DATABASE_URL` — PostgreSQL connection string (Supabase, Neon, или ваш сервер)
   - `NEXTAUTH_URL` — https://your-domain.vercel.app
   - `NEXTAUTH_SECRET` — сгенерируйте через `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
   - `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_TOKEN` — YooKassa
3. Deploy автоматически запустится при push в `main`.

### Database для Vercel

Рекомендуется использовать managed PostgreSQL:
- **Supabase** (бесплатный tier, realtime, auth)
- **Neon** (serverless PostgreSQL)
- **Railway** (PostgreSQL + деплой)

После создания БД:
```bash
# Применить миграции
npx prisma migrate deploy
```

## Docker

### Локально

```bash
# Сборка и запуск
docker-compose up -d

# Логи
docker-compose logs -f app

# Остановка
docker-compose down
```

### Production server

```bash
# Сборка образа
docker build -t involtcad-web .

# Запуск
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e NEXTAUTH_URL=https://your-domain.com \
  -e NEXTAUTH_SECRET=your-secret \
  involtcad-web
```

## VPS (Ubuntu/Debian)

1. Установите Node.js 20, PostgreSQL 16, nginx.
2. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/InvoltAM/InvoltCAD-web.git
   cd InvoltCAD-web
   ```
3. Установите зависимости:
   ```bash
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   ```
4. Соберите проект:
   ```bash
   npm run build
   ```
5. Запустите через PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name involtcad-web -- start
   pm2 save
   pm2 startup
   ```
6. Настройте nginx как reverse proxy на `localhost:3000`.

## Мониторинг

Рекомендуется добавить:
- **Sentry** — отслеживание ошибок
- **Vercel Analytics** — метрики производительности
- **Uptime Robot** — мониторинг доступности
