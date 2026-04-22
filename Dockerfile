FROM node:20-alpine

# Install git (needed for diff operations) and pnpm
RUN apk add --no-cache git && corepack enable && corepack prepare pnpm@latest --activate

# Copy package files and install production dependencies
WORKDIR /action
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
