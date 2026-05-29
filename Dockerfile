FROM golang:1.25-bookworm AS pmtiles-cli

RUN go install github.com/protomaps/go-pmtiles@latest

FROM python:3.12-slim AS oiab-core

LABEL org.opencontainers.image.title="Overland In A Box Core"
LABEL org.opencontainers.image.description="Standalone OIAB backend and web frontend."
LABEL org.opencontainers.image.source="https://github.com/jasondaemon/oiab"

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV OIAB_BIND_HOST=0.0.0.0
ENV OIAB_PORT_HTTP=8080
ENV OIAB_DATA_DIR=/data/oiab
ENV OIAB_DEV_MODE=false
ENV OIAB_AUTO_INSTALL_WORLD_MAP=true

WORKDIR /opt/oiab

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      gdal-bin \
      wamerican \
    && (apt-get install -y --no-install-recommends tippecanoe || true) \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /opt/oiab/backend/requirements.txt
RUN if [ -s /opt/oiab/backend/requirements.txt ]; then \
      pip install --no-cache-dir -r /opt/oiab/backend/requirements.txt; \
    fi

COPY backend /opt/oiab/backend
COPY frontend /opt/oiab/frontend
COPY config /opt/oiab/config
COPY services /opt/oiab/services
COPY scripts /opt/oiab/scripts
COPY docs /opt/oiab/docs
COPY licenses /opt/oiab/licenses
COPY README.md ARCHITECTURE.md DATA_LAYOUT.md MIGRATION.md TODO.md THIRD_PARTY_NOTICES.md LICENSE.md /opt/oiab/
COPY --from=pmtiles-cli /go/bin/go-pmtiles /usr/local/bin/pmtiles

RUN useradd --system --uid 10001 --gid 0 --home-dir /opt/oiab oiab \
    && mkdir -p /data/oiab \
    && chown -R oiab:0 /opt/oiab /data/oiab \
    && chmod -R g=u /opt/oiab /data/oiab

USER oiab

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=3).read()"

CMD ["python", "-m", "backend.app.main", "--host", "0.0.0.0", "--port", "8080"]
