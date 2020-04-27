worker_processes auto;

events {}

http {
  include mime.types;

  gzip on;
  gzip_types text/css application/javascript;

  ssl_session_cache   shared:SSL:10m;
  ssl_session_timeout 10m;

  server {
    listen              80;
    listen              443 ssl;
    server_name         ${NGINX_SERVER_NAME};
    keepalive_timeout   70;

    ssl_certificate     ${NGINX_SSL_CERTIFICATE};
    ssl_certificate_key ${NGINX_SSL_CERTIFICATE_KEY};
    ssl_protocols       TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers         HIGH:!aNULL:!MD5;
  }
}
