FROM node:12.10-alpine

ENV NODE_ENV production
ENV PORT 8000
ENV HARDWARE_PATH "/hw/rt"

EXPOSE 8000
CMD ["node", "."]

WORKDIR /src
RUN chown node:node /src
USER node
COPY . .
RUN npm ci
