FROM projectdiscovery/nuclei:latest AS nuclei

FROM ghcr.io/zaproxy/zaproxy:stable

USER root
RUN apt-get update \
  && apt-get install --yes --no-install-recommends nodejs npm nmap tini \
  && rm -rf /var/lib/apt/lists/*
COPY --from=nuclei /usr/local/bin/nuclei /usr/local/bin/nuclei

WORKDIR /opt/verifygrid
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY verifygrid-sensor.mjs verifygrid-scanners.mjs ./
RUN mkdir -p /tmp/nuclei-home /var/lib/verifygrid /zap/wrk \
  && HOME=/tmp/nuclei-home nuclei -update-templates \
  && mv /tmp/nuclei-home/nuclei-templates /opt/verifygrid/nuclei-templates \
  && rm -rf /tmp/nuclei-home \
  && chown -R zap:zap /opt/verifygrid /var/lib/verifygrid /zap/wrk

USER zap
ENV HOME=/var/lib/verifygrid \
    NODE_ENV=production \
    VERIFYGRID_BASE_URL=https://www.qcsstudio.com
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "verifygrid-sensor.mjs"]
