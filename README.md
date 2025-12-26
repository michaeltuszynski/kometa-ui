# Kometa UI

A web-based UI for monitoring and configuring [Kometa](https://kometa.wiki/) (formerly Plex Meta Manager) running on Synology NAS.

## Features

- **Dashboard**: View container status, next scheduled run, and last run information
- **Run Control**: Trigger manual Kometa runs, stop, or restart the container
- **Real-time Logs**: Stream logs via WebSocket with filtering and search
- **Configuration Editor**:
  - Guided forms for common settings
  - Raw YAML editor with syntax highlighting
  - Automatic backups before saves

## Screenshots

The UI provides three main views:
- **Dashboard** - Status cards and quick actions
- **Logs** - Live log streaming with level filtering
- **Config** - Dual-mode configuration editor

## Deployment on Synology NAS

### Prerequisites

- Synology NAS with Container Manager (Docker) installed
- Existing Kometa container running
- SSH access to NAS

### Setup

1. The UI code should be at `/volume1/Downloads/kometa-ui`

2. The `kometa-ui` service is already configured in the docker-compose.yml at `/volume1/Downloads/docker/media-stack/docker-compose.yml`

3. Build and start the container:

```bash
ssh nas
cd /volume1/Downloads/docker/media-stack
sudo /volume1/@appstore/ContainerManager/usr/bin/docker-compose up -d --build kometa-ui
```

4. Access the UI at `http://<your-nas-ip>:3000`

### Docker Compose Configuration

The following is added to your media-stack docker-compose.yml:

```yaml
kometa-ui:
  build: /volume1/Downloads/kometa-ui
  container_name: kometa-ui
  environment:
    - PUID=1026
    - PGID=100
    - TZ=America/Los_Angeles
    - PORT=3000
    - KOMETA_CONFIG_PATH=/kometa-config
    - KOMETA_CONTAINER_NAME=kometa
  volumes:
    - /volume1/Downloads/docker/plex-meta-manager/config:/kometa-config
    - /var/run/docker.sock:/var/run/docker.sock:ro
  ports:
    - 3000:3000
  restart: unless-stopped
  depends_on:
    - kometa
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Web server port | 3000 |
| KOMETA_CONFIG_PATH | Path to Kometa config inside container | /kometa-config |
| KOMETA_CONTAINER_NAME | Name of Kometa container | kometa |

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start development servers (backend + frontend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Tech Stack

- **Backend**: Node.js, Express, TypeScript, Socket.IO, Dockerode
- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui, CodeMirror

## License

MIT
