FROM node:22-alpine
ENV NODE_ENV=production PORT=3080 DATA_DIR=/tmp/moneypilot COOKIE_SECURE=1
WORKDIR /app
RUN apk add --no-cache unzip
COPY MoneyPilot-deploy-ready-preview.zip /tmp/moneypilot.zip
RUN unzip -q /tmp/moneypilot.zip -d /tmp/extracted \
    && cp -R /tmp/extracted/moneypilot/. /app/ \
    && mkdir -p /tmp/moneypilot \
    && chown -R node:node /app /tmp/moneypilot \
    && rm -rf /tmp/extracted /tmp/moneypilot.zip
USER node
EXPOSE 3080
CMD ["node", "src/server.js"]
