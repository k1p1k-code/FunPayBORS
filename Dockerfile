FROM rust:1.92.0 AS rust-builder

RUN apt-get update && apt-get install -y \
    python3.13 \
    python3.13-dev \
    python3.13-venv \
    pkg-config \
    libpython3.13 \
    && rm -rf /var/lib/apt/lists/*

ENV PYO3_PYTHON=/usr/bin/python3.13

WORKDIR /usr/src/app

COPY . .

RUN cargo build --release && \
    strip target/release/FunPayBORS && \
    rm -rf /usr/local/cargo/registry target/release/build target/release/deps target/release/.fingerprint

COPY . .

RUN cargo build --release && \
    strip target/release/FunPayBORS && \
    rm -rf /usr/local/cargo/registry target/release/build target/release/deps target/release/.fingerprint

FROM node:20-alpine AS node-builder
WORKDIR /app
COPY solid-interface-funpaybors/package*.json ./
RUN npm ci
COPY solid-interface-funpaybors/ .
RUN npm run build

FROM alpine:3.19

RUN apk add --no-cache \
    python3 \
    py3-pip \
    ca-certificates \
    && ln -sf python3 /usr/bin/python

RUN adduser -D -u 1000 appuser
USER appuser

WORKDIR /app
RUN mkdir -p plugins html

COPY --from=rust-builder /usr/src/app/target/release/FunPayBORS /app/
COPY --from=rust-builder /usr/src/app/config.json /app/
COPY --from=node-builder /app/dist/ /app/html/

EXPOSE 58899
ENTRYPOINT ["./FunPayBORS"]
CMD ["--server"]