FROM node:24-slim

# Install git (needed for diff operations), curl/ca-certificates (needed for
# downloading release binaries), and pnpm.
#
# NOTE: if comment stripping is added in future, the pre-built binary from
# https://github.com/rhythmcache/comment-remover/releases is x86_64-unknown-linux-gnu
# (glibc). This image is glibc-based, so that binary will work here directly
# via curl download — no Rust toolchain required.

RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

# Copy package files and install production dependencies
WORKDIR /action
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
