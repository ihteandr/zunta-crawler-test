FROM timbru31/node-chrome

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD [ "npm", "run" "start:stage" ]