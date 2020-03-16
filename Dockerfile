FROM node:10 AS build
COPY . /build
WORKDIR /build
RUN yarn build

FROM nginx
COPY --from=build /build/packages/frontend/build /etc/nginx/html
