FROM node:fermium

WORKDIR /usr/src/app

# hadolint ignore=DL3009
RUN apt-get install -y chromium-browser

COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build
EXPOSE 8080
CMD [ "npm", "run" "start:stage" ]