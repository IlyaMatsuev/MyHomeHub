FROM node:20-alpine

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm i --silent

COPY . ./

RUN npm run build

CMD ["node", "dist/main"]
