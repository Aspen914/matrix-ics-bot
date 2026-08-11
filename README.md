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

## Upgrading

This project follows a modern toolchain:

- TypeScript 5 with strict mode
- ESLint (flat config) instead of the deprecated TSLint
- [Luxon](https://moment.github.io/luxon/) instead of the legacy Moment.js
- `node:crypto`'s `randomUUID` instead of the `uuid` package

After pulling in updated `package.json` dependencies, run `yarn install` once to regenerate
`yarn.lock` (it is not committed from this point).
