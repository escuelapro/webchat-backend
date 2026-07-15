# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Это код чата тех поддержки для проекта escuela.

## Project Overview

**webchat-backend** is a Node.js backend service that integrates Telegram bot functionality with real-time WebSocket communication. It manages chat messages, forwards them between users and Telegram groups, stores messages in MongoDB, and executes scheduled tasks via cron jobs.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (auto-reload with nodemon)
npm run dev

# Production mode
npm start

# Lint code
yarn precommit
```

The dev server runs on port specified in `.env` (default `4000`), and the WebSocket server listens on the same port.

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure required variables in `.env`:
   - **TBTKN**: Telegram bot token (required to start the app)
   - **PORT**: WebSocket server port (default: 4000)
   - **MONGO_URI**: MongoDB connection string (optional; if missing, warning is logged)
   - **TGADMIN**: Telegram user ID for admin commands
   - **TGGROUP**: Telegram group ID for logging
   - **NODE_CRON**: Cron interval pattern (e.g., `5` runs every 5 minutes)
   - **CRON_TASKS**: Comma-separated cron task names to execute
   - **APP_FRONTNAME**: Frontend domain for script injection
   - **TBTUSERNAME**: Bot username on Telegram

## Architecture

### Entry Point
`src/index.js` — Initializes the application:
- Loads environment variables via `src/config/vars.js`
- Connects to MongoDB via `src/config/mongoose.js` (graceful if missing)
- Instantiates Telegraf bot
- Sets up WebSocket server
- Registers bot routes, cron jobs, and socket handlers

### Core Components

**WebSocket Server** (`src/ws.js`)
- Manages real-time two-way communication
- Stores active connections in `sockets.g` (groups) and `sockets.u` (users)
- Handles incoming WebSocket messages:
  - `service: 'lastmes'` — Returns last N messages from MongoDB
  - Group chat messages — Stored in MongoDB and forwarded to Telegram
  - Image/screenshot messages — Saved to disk and sent as Telegram photo
- Generates unique user IDs for anonymous connections

**BotHelper** (`src/config/bot.js`)
- Wrapper class around Telegraf instance (`this.bot` and `this.tgbot`)
- Manages socket registry, admin detection, and message routing
- Key methods:
  - `botMes(chatId, text)` — Send message to Telegram chat
  - `sendPhot(chatId, fileObj, text)` — Send photo with caption
  - `sendAdmin(message)` — Send admin notifications
  - `clearUnusedChats()` — Cleanup stale socket connections
  - `getKey(chatId)` — Format group keys
  - `isAdmin(chatId)` — Check if sender is admin

**Database Layer** (`src/api/utils/db.js`)
- Direct Mongoose operations for messages and UIDs
- Uses collections from env: `MONGO_COL_MESS` (messages), `MONGO_COL_UIDS` (user IDs)
- Main functions:
  - `putChat(messageObj, key)` — Store message in MongoDB
  - `getLast(key, uid)` — Retrieve last N messages for a user
  - `putUidUser(uid, data)` — Store user ID mapping
  - `getUidUser(uid)` — Retrieve user ID data
  - `stat()` — Get statistics about stored messages

**Bot Routes** (`src/api/routes/botroute.js`)
- Sets up Telegraf command handlers (e.g., `/stat`, `/statuids`)
- Admin-only commands only execute if sender matches `TGADMIN`
- Passes control to message formatter for handling text messages

**Message Formatter** (`src/api/routes/chat/index.js`)
- Handles incoming Telegram messages and text commands
- Routes messages to WebSocket clients in real-time
- Applies custom message formatting

**Cron Jobs** (`src/cron.js`)
- Dynamic cron task loader that parses `NODE_CRON` and `CRON_TASKS` env variables
- Format: `NODE_CRON=5:10` and `CRON_TASKS=task1:task2` runs `task1` every 5 min, `task2` every 10 min
- Each task is a `.js` file in `src/service/commands/` with an async `run(opts, botHelper)` export
- Task execution uses Cron library (e.g., `0 */5 * * * *` format)

### Data Flow

1. **Incoming WebSocket message** → `ws.js` handles, stores in MongoDB (if not a login), forwards to Telegram via `BotHelper.botMes()`
2. **Incoming Telegram message** → `botroute.js` routes → `message formatter` → broadcasts to all WebSocket clients connected to that group
3. **Admin command** → `botroute.js` checks `isAdmin()` → executes database query → replies via Telegram
4. **Scheduled task** → `cron.js` parses env config → dynamically loads `src/service/commands/<task>.js` → executes `run()` method

## Key Implementation Details

**Socket Key Format**
- Group sockets: `${groupId}_chat_${uid}` (e.g., `123_chat_abc5`)
- Telegram group ID is stored as negative (e.g., `-123` in messages, `123` in socket keys)

**Image Handling**
- Base64 images in WebSocket messages are temporarily written to disk
- File is immediately sent to Telegram as a photo
- File is deleted after successful send (inside `.then()`, not guaranteed on error)

**User ID Assignment**
- New WebSocket connections without `uid` get a random 5-char ID (via `uid-safe`)
- If unassigned, hyphens are stripped to create a valid ID
- Existing `uid` in message is preserved and echoed back to client

**Admin Detection**
- Only `TGADMIN` user ID can execute bot commands (`/stat`, `/statuids`, etc.)
- Admin notifications are sent via `sendAdmin()` when errors occur

**Database Optionality**
- If `MONGO_URI` is not set, app starts with a warning
- WebSocket and Telegram functionality work without MongoDB
- Only features that require message history fail gracefully

## Deployment Notes

See `README.md` for production deployment instructions (PM2 + Nginx + SSL setup).

## Code Style

- ESLint configuration in `.eslintrc` extends `airbnb-base`
- Rules allow `console.log`, no underscore dangle, ignore unused `next` params
- Run `yarn precommit` to lint before committing
