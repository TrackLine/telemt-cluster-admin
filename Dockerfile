# Stage 1: Build frontend
FROM node:22-alpine AS web-builder
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS go-builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web-builder /build/web/dist ./web/dist
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o cluster-admin .

# Stage 3: Minimal runtime
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata wget
WORKDIR /app
COPY --from=go-builder /build/cluster-admin .
VOLUME ["/data"]
ENV DB_PATH=/data/cluster.db
ENV PORT=3000
ENV POLL_INTERVAL=15s
EXPOSE 3000
CMD ["./cluster-admin"]
