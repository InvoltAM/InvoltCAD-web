# Деплой InvoltCAD Web в Production

## Вариант 1: Vercel (рекомендуется)

### Шаг 1: Создать production БД

#### Supabase (рекомендуется)
1. Зарегистрируйтесь на https://supabase.com
2. Создайте новый проект
3. Получите `DATABASE_URL` из Settings → Database → Connection string
4. Включите Realtime (для совместного доступа)

#### Neon
1. Зарегистрируйтесь на https://neon.tech
2. Создайте новый проект
3. Получите `DATABASE_URL` из Dashboard → Connection Details

#### Railway
1. Зарегистрируйтесь на https://railway.app
2. Создайте новый проект → PostgreSQL
3. Получите `DATABASE_URL` из Variables

### Шаг 2: Применить миграции

```bash
# Локально, с production DATABASE_URL
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Шаг 3: Настроить Vercel

1. Подключите репозиторий `InvoltAM/InvoltCAD-web` к Vercel
2. Настройте переменные окружения в Vercel Dashboard:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-secret-key-generate-with-openssl-rand-base64-32"

# OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email (опционально)
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="noreply@your-domain.com"
EMAIL_SERVER_PASSWORD="your-smtp-password"
EMAIL_FROM="noreply@your-domain.com"

# Billing
YOOKASSA_SHOP_ID="your-yookassa-shop-id"
YOOKASSA_SECRET_KEY="your-yookassa-secret-key"
YOOKASSA_WEBHOOK_TOKEN="your-webhook-token"

# Sentry
NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..."
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="your-auth-token"

# App
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
```

3. Deploy автоматически запустится при push в `main`

### Шаг 4: Настроить домен и SSL

1. В Vercel Dashboard → Settings → Domains
2. Добавьте ваш домен (например, `involtcad.ru`)
3. Vercel автоматически настроит SSL через Let's Encrypt
4. Обновите `NEXTAUTH_URL` и `NEXT_PUBLIC_APP_URL` на новый домен

### Шаг 5: Настроить мониторинг

#### Sentry
1. Зарегистрируйтесь на https://sentry.io
2. Создайте новый проект → Next.js
3. Получите DSN и добавьте в `NEXT_PUBLIC_SENTRY_DSN`
4. Настройте alerts для ошибок

#### Uptime Robot
1. Зарегистрируйтесь на https://uptimerobot.com
2. Создайте новый монитор → HTTP(s)
3. URL: `https://your-domain.vercel.app/api/health`
4. Интервал: 5 минут
5. Настройте уведомления (email, Telegram, Slack)

#### Vercel Analytics
1. В Vercel Dashboard → Analytics
2. Включите Web Analytics
3. Включите Speed Insights

## Вариант 2: VPS (Docker)

### Шаг 1: Подготовка сервера

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
```

### Шаг 2: Клонирование и настройка

```bash
git clone https://github.com/InvoltAM/InvoltCAD-web.git
cd InvoltCAD-web

# Создайте .env с production переменными
cp .env.example .env
# Отредактируйте .env

# Запустите
docker-compose up -d
```

### Шаг 3: Настройка Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Шаг 4: SSL через Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com
```

## Проверка деплоя

После деплоя проверьте:
- [ ] Главная страница загружается
- [ ] Редактор работает (`/editor`)
- [ ] Авторизация работает (`/login`)
- [ ] Проекты сохраняются и загружаются
- [ ] Платежи работают (`/pricing`)
- [ ] Маркетплейс работает (`/marketplace`)
- [ ] Sentry получает ошибки
- [ ] Uptime Robot показывает "Up"

## Rollback

Если что-то пошло не так:
1. В Vercel Dashboard → Deployments → выберите предыдущий деплой → Promote to Production
2. Или через Git: `git revert HEAD && git push origin main`
