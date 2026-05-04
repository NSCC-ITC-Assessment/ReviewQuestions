# ---------------------------------------------------------------------------
# Stage 1 — build the rmcm binary from source
# ---------------------------------------------------------------------------
FROM rust:slim-bookworm AS rmcm-builder

# git is required to clone the source repository
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Clone the production branch and build the release binary.
# The Cargo profile already enables strip = true and LTO so the output is
# small and self-contained.
RUN git clone --depth 1 --branch production \
        https://github.com/NSCC-ITC-Assessment/comment-remover.git /build
WORKDIR /build
RUN cargo build --release --all-features

# ---------------------------------------------------------------------------
# Stage 2 — final action image
# ---------------------------------------------------------------------------
FROM node:25-slim

# Install git (needed for diff operations) and pnpm.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

# Copy the rmcm binary built in stage 1
COPY --from=rmcm-builder /build/target/release/rmcm /usr/local/bin/rmcm

# Copy package files and install production dependencies
WORKDIR /action
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
