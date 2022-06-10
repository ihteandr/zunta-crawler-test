FROM node:fermium

WORKDIR /usr/src/app

RUN apt-get update
RUN apt-get install chromium -y

COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build
EXPOSE 8080
CMD [ "npm", "run" "start:stage" ]