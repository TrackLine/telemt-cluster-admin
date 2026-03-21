# telemt-cluster-admin

Минималистичная панель мониторинга MTProto прокси-кластера.

## Запуск через Docker

```bash
docker compose up -d
```

Открыть: http://localhost:3000

## Запуск для разработки

```bash
# Backend (Go)
mkdir -p data
go run .

# Frontend (в отдельном терминале)
cd web
npm install
npm run dev   # http://localhost:5173, proxy → :3000
```

## Добавление нод

1. **Backend-нода (telemt EU):**
   Требует доступ на порт `9091` (telemt API) с IP панели.
   `ufw allow from <IP_ПАНЕЛИ> to any port 9091`

2. **Entry-нода (HAProxy RU):**
   Требует доступ на порт `8404` (HAProxy stats) с IP панели.
   В `haproxy.cfg` изменить `bind 127.0.0.1:8404` → `bind 0.0.0.0:8404`
   `ufw allow from <IP_ПАНЕЛИ> to any port 8404`

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `3000` | HTTP порт панели |
| `DB_PATH` | `./data/cluster.db` | Путь к SQLite базе |
| `POLL_INTERVAL` | `15s` | Интервал опроса нод |
