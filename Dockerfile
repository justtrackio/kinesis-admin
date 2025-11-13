# Stage 1: Build the frontend
FROM oven/bun:1.3.2 AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install
COPY frontend/ ./
RUN bun run build

# Stage 2: Build the backend
FROM golang:1.25 AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/kinesis-admin .

# Stage 3: Create the final image
FROM gcr.io/distroless/static-debian11
COPY --from=backend /app/kinesis-admin /
ENTRYPOINT ["/kinesis-admin"]
