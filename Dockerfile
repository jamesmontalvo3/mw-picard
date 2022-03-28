FROM node:16-alpine
ENV NODE_ENV=production
WORKDIR /mw-picard
COPY ./dist/* /mw-picard
RUN npm install