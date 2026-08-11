# matrix-ics-bot

A Matrix bot which deals with recurring reminders in a complicated way. Ideal if you want to
do something with a complicated not-cron schedule based on an [iCalendar](https://en.wikipedia.org/wiki/ICalendar)
file.

Help: [#matrix-ics-bot:t2bot.io](https://matrix.to/#/#matrix-ics-bot:t2bot.io)

## Features

- Upload an `.ics` file to a room and the bot creates a recurring reminder from it.
- Reminders are stored per-room as room account data, surviving bot restarts.
- Commands for listing, editing, and deleting reminders (`!list`, `!edit`, `!delete`, `!help`).
- Permission checks via Matrix power levels.

## Requirements

- Node.js **>= 22** (see `engines` in `package.json`)
- Yarn classic (`yarn`) for installing dependencies

## Running / Building

Install the dependencies and generate a fresh lockfile:

```sh
yarn install
```

To build it (compiles `src/` to `lib/`):

```sh
yarn build
```

To typecheck without emitting output:

```sh
yarn typecheck
```

To lint:

```sh
yarn lint
```

To run it:

```sh
yarn start:dev
```

### Configuration

This bot uses the [`config`](https://github.com/node-config/node-config) package to manage
configuration. The default configuration is provided as `config/default.yaml`. Copy it to
`config/development.yaml` (and `config/production.yaml` for `NODE_ENV=production`) and edit
them for your environment.

- `homeserverUrl` - where the homeserver's Client-Server API lives.
- `accessToken` - an access token for the bot account. See https://t2bot.io/docs/access_tokens.
- `autoJoin` - whether to autojoin rooms when invited.
- `dataPath` - directory for local bot state (sync token, etc).
- `permissionCheck.roomReminders` - power level event checked before allowing reminder management.
- `admins` - user IDs that bypass permission checks.

### Docker

A multi-stage `Dockerfile` is included. The container expects your configuration in a volume
mounted at `/data/config`:

```sh
docker build -t matrix-ics-bot .
docker run -v "$PWD/config:/data/config:ro" matrix-ics-bot
```

#### Docker Compose

Requires Docker with the compose plugin (`docker compose`).

1. Clone the repository.
2. Create your configuration file and edit it with your homeserver URL, access token, and admins:
   ```
   cp config/default.yaml config/production.yaml
   ```
   Note: never commit `config/production.yaml` — it contains your access token and is already gitignored.
3. Create the storage directory for bot state:
   ```
   mkdir -p storage
   ```
4. Start the bot:
   ```
   docker compose up -d --build
   ```
5. Follow the logs to confirm it starts:
   ```
   docker compose logs -f
   ```

The container mounts `./config` (read-only) into `/data/config` where the `config` package looks for
`default.yaml` / `production.yaml`, and `./storage` into `/app/storage` where the bot persists its
state. Keeping these two directories on the host means your config and data survive container rebuilds.

To stop it: `docker compose down`. To update after a pull: `docker compose up -d --build`.

#### Using a published image

The project is set up to publish a pre-built image to the GitHub Container Registry. If you would
rather not build locally, point your compose file at the published image instead of the local build:

```
services:
  matrix-ics-bot:
    image: ghcr.io/<owner>/matrix-ics-bot:latest
    container_name: matrix-ics-bot
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    volumes:
      - ./config:/data/config:ro
      - ./storage:/app/storage
```

### CI/CD with GitHub Actions

The following workflows automate linting, building, and deploying the bot:

- `.github/workflows/ci.yml` — runs `yarn lint` and `yarn build` on every push to `master` and on
  every pull request.
- `.github/workflows/docker-publish.yml` — builds the Docker image and pushes it to GHCR
  (`ghcr.io/<owner>/matrix-ics-bot`) on pushes to `master` (tagged `latest`), on tags like `v1.0.0`,
  and manually via `workflow_dispatch`.
- `.github/workflows/docker-deploy.yml` — deploys the freshly published image to a server using
  Docker Compose over SSH. It runs automatically after `docker-publish.yml` succeeds and can also be
  triggered manually with a custom `image_tag`.

To enable the deploy workflow, add the following repository secrets (Settings -> Secrets and
variables -> Actions):

| Secret              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `DEPLOY_HOST`       | IP address or hostname of the target server                |
| `DEPLOY_USER`       | SSH user for the target server                             |
| `DEPLOY_SSH_KEY`    | Private SSH key (with a passphrase only if it is a `.pem`) |
| `DEPLOY_PORT`       | SSH port, defaults to `22` if omitted                      |

The deploy job connects as `DEPLOY_USER` and manages everything under `/opt/matrix-ics-bot` on the
server: it writes `docker-compose.yml`, runs `docker compose pull`, and starts the container with
`docker compose up -d`. The `config/` and `storage/` directories are created next to the compose
file; put your `production.yaml` in `/opt/matrix-ics-bot/config/` and it will be picked up.

## Upgrading

This project follows a modern toolchain:

- TypeScript 5 with strict mode
- ESLint (flat config) instead of the deprecated TSLint
- [Luxon](https://moment.github.io/luxon/) instead of the legacy Moment.js
- `node:crypto`'s `randomUUID` instead of the `uuid` package

After pulling in updated `package.json` dependencies, run `yarn install` once to regenerate
`yarn.lock` (it is not committed from this point).
