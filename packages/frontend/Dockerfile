# This Dockerfile is for quickly rolling an image from an already-built frontend.
# If you want to build the image yourself, you must build the frontend with `yarn build` first.

FROM nginx
COPY etc /etc
COPY build /usr/share/nginx/html
