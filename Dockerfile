FROM alpine:3.6

WORKDIR /usr/src/app

RUN apk update && apk add --no-cache nmap && \
    sh -c 'echo "http://nl.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories' && \
    sh -c 'echo http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories' && \
    apk update && \
    apk add --no-cache \
      chromium \
      harfbuzz \
      "freetype>2.8" \
      ttf-freefont \
      nss
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD [ "npm", "run" "start:stage" ]