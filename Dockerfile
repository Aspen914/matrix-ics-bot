# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV NODE_CONFIG_DIR=/data/config
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=build /app/lib ./lib
RUN mkdir -p /data
USER node
VOLUME ["/data"]
CMD ["node", "lib/index.js"]
