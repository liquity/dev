# This Dockerfile is for quickly rolling an image from an already-built dev-frontend.
# If you want to build the image yourself, you must build the dev-frontend with `yarn build` first.

FROM nginx
COPY etc /etc
COPY docker-entrypoint.d /docker-entrypoint.d
COPY build /usr/share/nginx/html
