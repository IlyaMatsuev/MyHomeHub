FROM node:20-alpine

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN apk add --no-cache tzdata
ENV TZ=Europe/Amsterdam

RUN npm i --silent

COPY . ./

RUN npm run build

CMD ["node", "dist/main"]
