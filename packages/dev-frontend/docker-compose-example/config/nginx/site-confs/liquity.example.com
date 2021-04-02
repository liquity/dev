server {
    listen 443 ssl;

    server_name liquity.example.com;

    include /config/nginx/ssl.conf;

    location / {
        include /config/nginx/proxy.conf;
        resolver 127.0.0.11 valid=5s;
        set $container dev-frontend;
        proxy_pass http://$container;
    }
}
