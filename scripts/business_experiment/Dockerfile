FROM mcr.microsoft.com/playwright:v1.57.0-noble
ARG TARGETARCH
RUN set -eu; \
    case "$TARGETARCH" in arm64) node_arch=arm64;; amd64) node_arch=x64;; *) exit 1;; esac; \
    curl -fsSL "https://nodejs.org/dist/v20.19.3/node-v20.19.3-linux-${node_arch}.tar.gz" \
      | tar -xz --strip-components=1 -C /usr/local
WORKDIR /opt/business-experiment
RUN npm init -y >/dev/null && npm install --save-exact @playwright/test@1.57.0 --no-audit --no-fund
ENV TZ=UTC NODE_PATH=/opt/business-experiment/node_modules
