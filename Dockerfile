FROM node:24-slim

# Install git (needed for diff operations), curl/ca-certificates (needed for
# downloading release binaries), and pnpm.

RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

# Download the comment-remover binary (rmcm) for stripping comments before AI analysis
RUN VERSION="v0.1.1" && \
    curl -fsSL "https://github.com/rhythmcache/comment-remover/releases/download/${VERSION}/comment-remover-x86_64-unknown-linux-gnu-${VERSION}.tar.gz" \
    | tar -xz -C /usr/local/bin rmcm

# Copy package files and install production dependencies
WORKDIR /action
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
