FROM node:12.10-alpine

ENV NODE_ENV production

CMD ["node", "."]

WORKDIR /src
RUN chown node:node /src
USER node
COPY . .
RUN npm ci
