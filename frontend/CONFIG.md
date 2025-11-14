# Runtime Configuration

The frontend API base URL can be configured at runtime by editing `dist/config.json` after building.

## Development

In development mode, the config is loaded from `public/config.json`:

```json
{
  "apiBaseUrl": "/api"
}
```

The Vite dev server proxies `/api` to `http://localhost:8080` (or `VITE_API_BASE_URL` if set).

## Production

After building (`bun run build`), edit `dist/config.json` to point to your backend:

```json
{
  "apiBaseUrl": "https://api.example.com/api"
}
```

No rebuild required - just update the JSON file and refresh the page.

## Docker/Container Deployments

You can mount or replace `config.json` at runtime:

```bash
# Docker
docker run -v ./my-config.json:/app/dist/config.json your-image

# Kubernetes ConfigMap
kubectl create configmap frontend-config --from-file=config.json
```
