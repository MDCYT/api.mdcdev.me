FROM node:20.6.1

ENV NODE_ENV production
ENV NPM_CONFIG_UPDATE_NOTIFIER false
ENV NPM_CONFIG_FUND false

RUN apk add --update --no-cache \
    libuuid \
    python3 \
    build-base \
    pkgconf \
    pixman \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . ./

CMD node src/index.js