FROM rust:latest AS rust-builder

RUN apt-get update && apt-get install -y \
    python3.13 \
    python3.13-venv \
    python3.13-dev \
    libpython3.13-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.13 /usr/bin/python \
    && ln -sf /usr/bin/python3.13 /usr/bin/python3

ENV PYO3_PYTHON=/usr/bin/python3.13

WORKDIR /usr/src/app
COPY . .
RUN cargo build --release

FROM node:20-alpine AS node-builder
WORKDIR /app
COPY solid-interface-funpaybors/ .
RUN npm ci && npm run build

FROM debian:trixie-slim

RUN apt-get update && apt-get install -y \
    python3.13 \
    python3.13-dev \
    python3.13-venv \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.13 /usr/bin/python \
    && ln -sf /usr/bin/python3.13 /usr/bin/python3 \
    && ldconfig

RUN mkdir -p /app/plugins /app/html
COPY --from=rust-builder /usr/src/app/target/release/FunPayBORS /app/
COPY --from=rust-builder /usr/src/app/config.json /app/
COPY --from=node-builder /app/dist/ /app/html/

WORKDIR /app
EXPOSE 58899


ENTRYPOINT ["./FunPayBORS"]
CMD ["--server"]