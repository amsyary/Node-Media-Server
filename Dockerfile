FROM node:lts-alpine

ARG BUILD_DATE
ARG VCS_REF

LABEL org.label-schema.build-date="${BUILD_DATE}" \
      org.label-schema.name="node-media-server" \
      org.label-schema.description="A Node.js implementation of RTMP Server" \
      org.label-schema.usage="https://github.com/amsyary/Node-Media-Server#readme" \
      org.label-schema.vcs-ref="${VCS_REF}" \
      org.label-schema.vcs-url="https://github.com/amsyary/Node-Media-Server" \
      org.label-schema.vendor="amsyari" \
      org.label-schema.version="2.5.0" \
      maintainer="https://github.com/amsyary"

WORKDIR /usr/src/app

RUN apk add --no-cache ffmpeg

# Set environment variable for ffmpeg path
ENV FFMPEG_PATH=/usr/bin/ffmpeg

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 1935 8000 8443

CMD ["node","bin/app.js"]