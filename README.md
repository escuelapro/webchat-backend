# WebChat Backend

Backend для Telegram-бота с поддержкой WebSocket.

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

По умолчанию в dev используется порт из скрипта (`PORT=1234`). Для проверки: `wscat -c ws://localhost:1234`.

## Развёртывание в production (Яндекс Облако)

Инструкция рассчитана на виртуальную машину Ubuntu в Yandex Cloud.

### 0. Подготовка в консоли Яндекс Облака

1. Создайте VM (Ubuntu 22.04) с публичным IP.
2. В Security Group откройте входящие порты: `22` (SSH), `80` (HTTP), `443` (HTTPS).
3. Создайте A-запись DNS: `chat.escuela.pro` → публичный IP VM.
4. Дождитесь распространения DNS (нужно **до** выпуска SSL).

### 1. Подключение к серверу

```bash
ssh yc-user@YOUR_SERVER_IP
```

### 2. Установка Node.js 18

В `package.json` указан engine `16.x`, на практике используется Node.js 18.

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # ожидается v18.x
```

### 3. Клонирование и установка

```bash
git clone https://github.com/escuelapro/webchat-backend.git
cd webchat-backend
npm install
cp .env.example .env
nano .env  # настроить переменные окружения
```

В `.env` для production задайте как минимум:

| Переменная | Назначение |
|---|---|
| `TBTKN` | токен Telegram-бота (**обязательно**) |
| `PORT` | порт Node/WebSocket (по умолчанию `4000`) |
| `MONGO_URI` | строка подключения MongoDB |
| `TGADMIN` | Telegram user ID админа |
| `TGGROUP` | ID группы для логов |
| `APP_FRONTNAME` | домен фронтенда виджета |
| `TBTUSERNAME` | username бота |

`PORT` в `.env` должен совпадать с портом в `proxy_pass` Nginx (ниже — `4000`).

### 4. Firewall на VM (если включён ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Порты Node (`4000`) наружу открывать не нужно — доступ идёт через Nginx.

### 5. Запуск через PM2

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

### 6. Настройка Nginx для WebSocket

```bash
# Установка Nginx
sudo apt install nginx -y

# Создание конфигурации
sudo nano /etc/nginx/sites-available/webchat
```

Вставить конфигурацию (порт `4000` = значение `PORT` в `.env`):

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

Проверьте, что домен уже указывает на сервер:

```bash
curl -I http://chat.escuela.pro
```

### 7. SSL-сертификат (Let's Encrypt)

DNS A-запись должна уже указывать на этот сервер, иначе certbot не выпустит сертификат.

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d chat.escuela.pro
# Выбрать опцию 2 (Redirect HTTP to HTTPS)
```

После установки WebSocket доступен по `wss://chat.escuela.pro`.

### 8. Обновление проекта

```bash
cd ~/webchat-backend   # или путь, куда клонировали репозиторий
git pull
npm install
pm2 restart webchat
```

## Проверка работы

- Локально (dev): `wscat -c ws://localhost:1234`
- На сервере (порт из `.env`): `wscat -c ws://localhost:4000`
- Через домен: `wscat -c wss://chat.escuela.pro`
- Процесс Node: `sudo lsof -i -P -n | grep node`
- PM2: `pm2 status` / `pm2 logs webchat`

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

Создайте файл `.env` на основе `.env.example` и настройте необходимые переменные (см. таблицу в шаге 3).
Без `TBTKN` приложение не стартует; без `MONGO_URI` история сообщений недоступна, остальное работает.
