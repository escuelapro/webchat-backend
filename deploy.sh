#!/usr/bin/env bash
# Деплой в Cloud Run. Использование: ./deploy.sh test|prod
# Секреты (Secret Manager): webchat-<env>-tbtkn, опционально webchat-<env>-mongo-uri.
# Остальные переменные: файл deploy.<env>.env (KEY=VALUE, в git не коммитится).
set -euo pipefail

ENV_NAME="${1:?usage: ./deploy.sh test|prod}"
PROJECT=escuelapro-prod
REGION=europe-west1
SERVICE="webchat-backend-${ENV_NAME}"
VARS_FILE="deploy.${ENV_NAME}.env"

[ -f "$VARS_FILE" ] || { echo "Нет файла $VARS_FILE"; exit 1; }
ENV_VARS=$(grep -v '^\s*#' "$VARS_FILE" | grep -v '^\s*$' | paste -sd '@' -)

SECRETS="TBTKN=webchat-${ENV_NAME}-tbtkn:latest"
if gcloud secrets describe "webchat-${ENV_NAME}-mongo-uri" --project "$PROJECT" >/dev/null 2>&1; then
  SECRETS="${SECRETS},MONGO_URI=webchat-${ENV_NAME}-mongo-uri:latest"
fi

# Бот работает через вебхук, CPU тарифицируется только во время запросов.
# Ровно один инстанс: сокеты и привязки чатов хранятся в памяти (без Mongo).
WEBHOOK_DOMAIN=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)' 2>/dev/null | sed 's#https://##')
[ -n "$WEBHOOK_DOMAIN" ] && ENV_VARS="${ENV_VARS}@WEBHOOK_DOMAIN=${WEBHOOK_DOMAIN}"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  --min-instances 1 --max-instances 1 \
  --cpu-throttling \
  --cpu 1 --memory 512Mi \
  --timeout 3600 \
  --set-env-vars "^@^${ENV_VARS}" \
  --set-secrets "$SECRETS"
