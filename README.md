# Kinesis Admin

Kinesis Admin is a web UI designed to manage AWS Kinesis data streams across multiple accounts and regions. It features a React/TypeScript frontend built with Vite and Bun, and a Go backend that exposes a secure API for interacting with AWS Kinesis.

## Features

*   **Stream Listing:** View all available Kinesis streams, with pagination and filtering capabilities.
*   **Stream Details:** Get detailed information about a specific stream, including shards, retention, encryption, and monitoring.
*   **Publish Messages:** Publish messages to a Kinesis stream from the stream overview page. Automatically generates a UUID for the partition key if not provided.
*   **Delete Stream:** Delete individual Kinesis streams from their overview page.
*   **Delete All Streams:** Delete all Kinesis streams from the main list page (with confirmation).
*   **Message Decoding:** Messages displayed in the stream overview are decoded from Base64 for readability.

## Technologies Used

### Frontend
*   **Framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Package Manager:** Bun
*   **UI Library:** Ant Design 5
*   **State Management/Data Fetching:** TanStack Query (React Query)
*   **Routing:** React Router DOM v6

### Backend
*   **Language:** Go (>=1.22)
*   **Framework:** Gosoline
*   **AWS SDK:** aws-sdk-go-v2
*   **HTTP Server:** Gin

## Configuration

### Backend Configuration

The backend configuration is primarily managed through the `config.dist.yml` file. This file is embedded into the Go binary and provides default settings.

#### AWS Client Configuration

For local development, the application is pre-configured to use [LocalStack](https://docs.localstack.cloud/) as the AWS endpoint. The relevant configuration in `config.dist.yml` is:

```yaml
cloud:
  aws:
    defaults:
      credentials:
        access_key_id: justtrack
        secret_access_key: justtrack
      endpoint: http://localhost:4566
      region: eu-central-1
```

*   `endpoint`: Specifies the LocalStack endpoint.
*   `region`: Sets the AWS region for LocalStack.
*   `access_key_id` and `secret_access_key`: Dummy credentials for LocalStack.

#### Overriding Backend Configuration

You can override these default configurations using several methods provided by the Gosoline framework:

*   **Environment Variables:** For example, to change the AWS region, you can set `CLOUD_AWS_DEFAULTS_REGION=us-east-1`.
*   **Custom Configuration Files:** You can provide your own YAML configuration files.
*   **Command Line Flags:** Configuration values can also be passed as command-line arguments.

For more details on Gosoline's configuration system, refer to its official documentation.

### Frontend Configuration

The frontend API base URL can be configured **at runtime** without rebuilding. After building the frontend, edit `frontend/dist/config.json`:

```json
{
  "apiBaseUrl": "https://api.example.com/api"
}
```

In development mode, the config is loaded from `frontend/public/config.json` (defaults to `/api`, proxied by Vite to `http://localhost:8080`).

**For Docker/Container Deployments:** Mount or replace the config file at runtime:

```bash
docker run -v ./my-config.json:/app/frontend/dist/config.json kinesis-admin
```

See `frontend/CONFIG.md` for detailed configuration instructions.

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Go](https://golang.org/doc/install) (version 1.22 or higher)
*   [Bun](https://bun.sh/docs/installation) (version 1.0 or higher)
*   [Docker](https://docs.docker.com/get-docker/)
*   [LocalStack](https://docs.localstack.cloud/getting-started/installation/) (for local AWS development)

## Setup and Running Locally

### 1. Start LocalStack

This application is configured to use LocalStack for local AWS development. Start LocalStack in a separate terminal:

```bash
localstack start
```

### 2. Clone the Repository

```bash
git clone https://github.com/your-repo/kinesis-admin.git
cd kinesis-admin
```

### 3. Backend Setup

The backend API server runs independently from the frontend.

```bash
# Install Go dependencies
go mod tidy

# Run the backend server
go run main.go
```

The backend API will start on `http://localhost:8080`.

### 4. Frontend Development

For development with hot-reloading:

```bash
cd frontend

# Install Bun dependencies
bun install

# Start the frontend development server
bun run dev
```

The frontend development server will run on `http://localhost:5173` and proxy API requests to `http://localhost:8080`.

## Building and Running with Docker

The Docker image uses a multi-stage build with Caddy serving the frontend and proxying API requests to the Go backend.

### Architecture

- **Caddy (port 8080)**: Serves frontend static files and proxies `/api/*` requests to the backend
- **Go Backend (port 8081)**: Handles Kinesis API operations
- Frontend static files are served from `/var/www/html`
- Runtime configuration can be customized by mounting `config.json`

### 1. Build the Docker Image

```bash
docker build -t kinesis-admin .
```

### 2. Run the Docker Container

```bash
docker run -p 8080:8080 kinesis-admin
```

The application will be accessible at `http://localhost:8080`.

### 3. Custom Configuration

Mount a custom `config.json` to configure the API base URL at runtime:

```bash
docker run -p 8080:8080 \
  -v $(pwd)/custom-config.json:/app/frontend/dist/config.json \
  kinesis-admin
```

Example `custom-config.json`:
```json
{
  "apiBaseUrl": "/api"
}
```

## API Endpoints

The backend exposes the following API endpoints:

*   `GET /api/list`: Returns a list of all Kinesis stream names.
*   `DELETE /api/stream`: Deletes a specified Kinesis stream.
*   `GET /api/stream/describe?streamName={name}`: Returns metadata for a specific stream.
*   `GET /api/stream/messages?streamName={name}&limit={N}`: Returns recent messages from a stream.
*   `POST /api/stream/message`: Publishes a message to a Kinesis stream. Expects `streamArn`, `data`, and optionally `partitionKey` in the request body.

## Frontend Routes

*   `/`: Displays the list of Kinesis streams.
*   `/stream/:streamName`: Displays the overview and details for a specific Kinesis stream.

## Future Enhancements

*   WebSocket/SSE for real-time shard metrics.
*   Saved queries for frequent record sampling patterns.
*   Export stream configuration as IaC JSON template.
*   Multi-account/region selection.
*   Full authentication and authorization (Cognito/OIDC).

---
End of README.
