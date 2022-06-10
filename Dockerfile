FROM node:fermium

WORKDIR /usr/src/app

# hadolint ignore=DL3009
RUN apt-get update -qq \
  && apt-get install -qq --no-install-recommends \
    ca-certificates \
    apt-transport-https \
  && apt-get upgrade -qq

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update -qq \
  && apt-get install -qq --no-install-recommends \
    google-chrome-stable \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*


COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD [ "npm", "run" "start:stage" ]