# Kavita Uploader

A small web app for uploading book files into a Kavita library.

The uploader requires a login. On first start, set `AUTH_USERNAME` and `AUTH_PASSWORD`; the
credentials are stored as a password hash in `/data/uploader.sqlite`. Sessions are kept in memory
and expire when the server restarts.

## How it works

- The browser loads the list of folders in `/data` as available libraries.
- You choose a library and upload one or more files.
- Each file is saved in:

```text
/data/<library>/<book-name>/<original-file-name>
```

When no library is selected, the file goes directly under `/data/<book-name>/`.

Uploads are limited to 500 MB per file. Library names and uploaded filenames are treated as
single directory/file names, so they cannot write outside the configured data directory.

## Docker setup

Requirements:

- Docker
- Docker Compose
- Bun, if running outside Docker

Set the Docker network name in a `.env` file next to `docker-compose.yml`:

```env
DOCKER_NETWORK=my-network
```

The default is `kavita-uploader`. The network must already exist. Create it once if needed:

```bash
docker network create my-network
```

The Compose file mounts the Kavita library into the container:

```yaml
volumes:
  - ../kavita/library:/data
```

Change the left side if your Kavita library is somewhere else. The app listens on port `3000` inside the container and is exposed on `127.0.0.1:3003` on the host.

Start it:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f
```

Stop it:

```bash
docker compose down
```

## Configuration

Configuration is in `docker-compose.yml` and `.env`:

- `../kavita/library:/data` controls which library is modified.
- `127.0.0.1:3003:3000` controls the host port.
- `DOCKER_NETWORK` selects the existing Docker network to join.
- `AUTH_USERNAME` and `AUTH_PASSWORD` create the first user on an empty data directory.
- `DATA_DIR` changes the directory used by the server (default: `/data`).
- `PORT` changes the listening port (default: `3000`).

## Local development

```bash
bun install
bun run start
```

The app is then available at `http://localhost:3000`. For local development, create a `data` directory and change `/data` in `server.js` if you do not want to use the system path.

## Download and run the Docker package

Published images are available from GitHub Container Registry. Log in if the package is private,
then download and run the latest image:

```bash
docker pull ghcr.io/tomas-santucho/kavita-uploader:latest
docker run -d --name kavita-uploader --restart unless-stopped \
  -p 127.0.0.1:3003:3000 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD='change-this-password' \
  -v /path/to/kavita/library:/data \
  ghcr.io/tomas-santucho/kavita-uploader:latest
```

Open `http://localhost:3003`, sign in, and select the mounted Kavita library. Use a strong
password and keep the port bound to localhost or put the service behind an authenticated proxy.

The Compose setup reads `AUTH_USERNAME` and `AUTH_PASSWORD` from `.env` automatically. Add them
alongside `DOCKER_NETWORK` before running `docker compose up -d --build`:

```env
AUTH_USERNAME=admin
AUTH_PASSWORD=change-this-password
```

If the SQLite database already contains a user, changing these variables does not replace that
user or password.

## Security note

Authentication protects the uploader API. Keep the service bound to localhost or put it behind a
trusted HTTPS reverse proxy. Do not commit `.env` files or passwords.

## Publish an image

Push a version tag to build and publish the image to GitHub Container Registry:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow checks that the tag matches `package.json` and publishes:

```text
ghcr.io/tomas-santucho/kavita-uploader:v1.0.0
ghcr.io/tomas-santucho/kavita-uploader:latest
```

After the first publish, set the package visibility to **Public** under the repository owner's GitHub Packages settings. The workflow is in `.github/workflows/publish.yml`.
