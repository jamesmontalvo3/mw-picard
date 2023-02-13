#
# BUILDER image
#
FROM node:16-alpine AS builder
WORKDIR /src

COPY package*.json ./
RUN npm install

COPY . /src
RUN npm run esbuild

#
# FINAL image
#
FROM node:16-alpine as final
RUN apk add --update --no-cache git
COPY --from=builder /src/dist/picard.js /picard.js
