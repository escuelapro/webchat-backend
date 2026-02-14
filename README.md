# WebChat Backend

Backend для Telegram бота с WebSocket поддержкой.

## Быстрый старт

### Локальная разработка

```bash
# Клонировать репозиторий
git clone https://github.com/escuelapro/webchat-backend.git
cd webchat-backend

# Установить зависимости
npm install

# Создать .env файл (скопировать из .env.example)
cp .env.example .env

# Запустить в режиме разработки
npm run dev
```

### Production развертывание

#### 1. Подключение к серверу

```bash
ssh yc-user@YOUR_SERVER_IP
```

#### 2. Установка Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # Проверить версию
```

#### 3. Клонирование и установка

```bash
git clone https://github.com/escuelapro/webchat-backend.git
cd webchat-backend
npm install
cp .env.example .env
nano .env  # Настроить переменные окружения
```

#### 4. Запуск через PM2

```bash
# Установка PM2
sudo npm install -g pm2

# Запуск приложения
pm2 start npm --name webchat -- start

# Автозапуск после перезагрузки
pm2 startup
pm2 save

# Просмотр логов
pm2 logs webchat
```

#### 5. Настройка Nginx для WebSocket

```bash
# Установка Nginx
sudo apt install nginx -y

# Создание конфигурации
sudo nano /etc/nginx/sites-available/webchat
```

Вставить конфигурацию:

```nginx
server {
    listen 80;
    server_name chat.escuela.pro;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Активировать:

```bash
sudo ln -s /etc/nginx/sites-available/webchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. SSL сертификат (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d chat.escuela.pro
# Выбрать опцию 2 (Redirect HTTP to HTTPS)
```

После установки WebSocket будет доступен по `wss://chat.escuela.pro`

#### 7. Обновление проекта

```bash
git pull
npm install
pm2 restart webchat
```

## Проверка работы

- Локально: `wscat -c ws://localhost:4000`
- Через домен: `wscat -c wss://chat.escuela.pro`
- Проверка порта: `sudo lsof -i -P -n | grep node`

## Структура проекта

```
webchat-backend/
├── src/
│   ├── index.js          # Точка входа
│   ├── ws.js             # WebSocket сервер
│   ├── api/              # API роуты
│   ├── config/           # Конфигурация
│   └── service/          # Сервисы
└── package.json
```

## Переменные окружения

Создайте файл `.env` на основе `.env.example` и настройте необходимые переменные.
