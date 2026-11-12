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
RUN node -e 'const fs=require("fs");const p="public/index.html";let h=fs.readFileSync(p,"utf8");const a=h.indexOf("<section class=\"section lighter\" id=\"app\" hidden>");const b=h.indexOf("</section></main>",a);if(a<0||b<0)throw Error("Dashboard section not found");const block=h.slice(a,b+10);h=h.slice(0,a)+h.slice(b+10);const anchor="<section class=\"section lighter\" id=\"features\">";if(!h.includes(anchor))throw Error("Features section not found");h=h.replace(anchor,block+"\\n"+anchor);fs.writeFileSync(p,h);'
USER node
EXPOSE 3080
CMD ["node", "src/server.js"]
