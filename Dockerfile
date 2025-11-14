# Stage 1: Build the frontend
FROM oven/bun:1.3.2 AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install
COPY frontend/ ./
RUN bun run build

# Stage 2: Build the backend
FROM golang:1.25 AS backend
WORKDIR /app/backend
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 3: Create the final image with Caddy for frontend and Go backend
FROM caddy:2-alpine
WORKDIR /app
COPY --from=backend /app/backend/main .
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Create startup script
RUN cat > /app/start.sh <<'EOF'
#!/bin/sh
# Start the backend in the background
/app/main &
# Start a simple caddy server for the frontend
caddy file-server --listen :8080 --root /app/frontend/dist
EOF
RUN chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
