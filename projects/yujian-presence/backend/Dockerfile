FROM oven/bun:latest
WORKDIR /app
COPY package.json .
COPY bun.lockb .
RUN bun install
COPY . .
RUN mkdir -p data
EXPOSE 3001
CMD ["bun", "run", "index.ts"]
