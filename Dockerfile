FROM node:12-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
RUN apk add --no-cache  chromium --repository=http://dl-cdn.alpinelinux.org/alpine/v3.10/main

COPY . .

EXPOSE 8080
CMD [ "npm", "run" "start:stage" ]