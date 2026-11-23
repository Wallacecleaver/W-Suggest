FROM node:22 AS base
WORKDIR /app

FROM base AS dependencies
COPY package*.json ./
RUN npm install

FROM dependencies AS id-database
COPY scripts/build-id-db.js ./scripts/
COPY data/watchmode_title_id_map.json ./data/
RUN node scripts/build-id-db.js

FROM base AS source
# The raw ID map is only needed by the cached database stage.
RUN --mount=type=bind,target=/build-context \
    tar -C /build-context --exclude=./data/watchmode_title_id_map.json -cf /tmp/w-suggest-source.tar . \
    && tar -xf /tmp/w-suggest-source.tar --no-same-owner -C /app \
    && rm /tmp/w-suggest-source.tar

FROM dependencies AS runtime
COPY --from=id-database /app/data/id_map.db ./data/
COPY --from=source /app/ ./

EXPOSE 3000
CMD ["node", "--max-old-space-size=256", "server.js"]
