# Linux Server Deployment Guide

Complete guide for deploying the John McAfee Persona Chatbot on a Linux server with nginx.

## Prerequisites

- Linux server (Ubuntu 20.04+ / Debian 11+ / CentOS 8+)
- Node.js >= 20.11.0
- nginx
- Domain name with DNS configured (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

## Step 1: Server Setup

### Install Node.js

```bash
# Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be >= 20.11.0
npm --version
```

### Install nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify nginx is running
sudo systemctl status nginx
```

### Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the instructions it outputs
```

## Step 2: Deploy Application

### Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www/ai-john-chatbot
sudo chown $USER:$USER /var/www/ai-john-chatbot

# Clone repository
cd /var/www/ai-john-chatbot
git clone https://github.com/Aintivirus-AI/ai-john-chatbot.git .

# Or if you have SSH access:
# git clone git@github.com:Aintivirus-AI/ai-john-chatbot.git .
```

### Install Dependencies

```bash
cd /var/www/ai-john-chatbot

# Install all dependencies (including dev dependencies needed for build)
npm install

# Build the application
npm run build

# Optional: After building, you can remove dev dependencies to save space
# npm prune --production
# Note: Keep dev dependencies if you plan to update frequently
```

### Create Environment File

```bash
# Create .env file
nano .env
```

Add the following (adjust values as needed):

```env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4.1-mini
ALLOWED_ORIGINS=https://aijohn.aintivirus.ai,https://www.aijohn.aintivirus.ai
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=30
CACHE_TTL_SECONDS=120
CACHE_MAX_ENTRIES=200
```

**Important:** Replace `aijohn.aintivirus.ai` with your actual domain name.

### Set Permissions

```bash
# Ensure .env is readable only by owner
chmod 600 .env

# Set ownership
sudo chown -R $USER:$USER /var/www/ai-john-chatbot
```

## Step 3: Configure PM2

### Start Application with PM2

```bash
cd /var/www/ai-john-chatbot

# Verify the build output exists
ls -la dist/server/src/index.js

# Start with PM2 using the correct path
pm2 start dist/server/src/index.js --name "ai-john-chatbot" --env production

# Alternative: Use npm start (which uses the correct path from package.json)
# pm2 start npm --name "ai-john-chatbot" -- start
```

### Save PM2 Configuration

```bash
pm2 save
```

### Useful PM2 Commands

```bash
# View status (shows all running processes)
pm2 status

# View logs
pm2 logs ai-john-chatbot

# Restart application
pm2 restart ai-john-chatbot

# Stop application (keeps in PM2 list)
pm2 stop ai-john-chatbot

# Stop and remove from PM2 list
pm2 delete ai-john-chatbot

# Stop all instances of a specific app
pm2 delete ai-john-chatbot

# Stop all PM2 processes
pm2 stop all

# Delete all PM2 processes
pm2 delete all

# Monitor
pm2 monit
```

## Step 4: Configure nginx

### Create nginx Configuration for API

```bash
sudo nano /etc/nginx/sites-available/ai-john-chatbot
```

Add the following configuration:

```nginx
# HTTP to HTTPS redirect (uncomment after SSL setup)
# server {
#     listen 80;
#     server_name aijohn.aintivirus.ai www.aijohn.aintivirus.ai;
#     return 301 https://$server_name$request_uri;
# }

# HTTP server (temporary, until SSL is configured)
server {
    listen 80;
    server_name aijohn.aintivirus.ai www.aijohn.aintivirus.ai;

    # Logging
    access_log /var/log/nginx/ai-john-chatbot-access.log;
    error_log /var/log/nginx/ai-john-chatbot-error.log;

    # Increase timeouts for AI responses
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Increase body size limit (adjust as needed)
    client_max_body_size 1M;

    # Proxy to Node.js application
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support (if needed in future)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host $host;
        access_log off;
    }

    # Serve widget static files
    location / {
        root /var/www/ai-john-chatbot/web/widget;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Cache static assets
        location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}

# HTTPS server (uncomment after SSL setup)
# server {
#     listen 443 ssl http2;
#     server_name aijohn.aintivirus.ai www.aijohn.aintivirus.ai;
#
#     # SSL certificates (Let's Encrypt)
#     ssl_certificate /etc/letsencrypt/live/aijohn.aintivirus.ai/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/aijohn.aintivirus.ai/privkey.pem;
#
#     # SSL configuration (recommended)
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#     ssl_session_cache shared:SSL:10m;
#     ssl_session_timeout 10m;
#
#     # Security headers
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#     add_header X-Frame-Options "SAMEORIGIN" always;
#     add_header X-Content-Type-Options "nosniff" always;
#     add_header X-XSS-Protection "1; mode=block" always;
#
#     # Logging
#     access_log /var/log/nginx/ai-john-chatbot-access.log;
#     error_log /var/log/nginx/ai-john-chatbot-error.log;
#
#     # Increase timeouts for AI responses
#     proxy_connect_timeout 60s;
#     proxy_send_timeout 60s;
#     proxy_read_timeout 60s;
#
#     # Increase body size limit
#     client_max_body_size 1M;
#
#     # Proxy to Node.js application
#     location /api/ {
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         
#         # Headers
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_set_header X-Forwarded-Host $host;
#         proxy_set_header X-Forwarded-Port $server_port;
#         
#         # WebSocket support
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection "upgrade";
#         
#         # Buffering
#         proxy_buffering off;
#         proxy_request_buffering off;
#     }
#
#     # Health check endpoint
#     location /health {
#         proxy_pass http://localhost:3000/health;
#         proxy_set_header Host $host;
#         access_log off;
#     }
#
#     # Serve widget static files
#     location / {
#         root /var/www/ai-john-chatbot/web/widget;
#         try_files $uri $uri/ /index.html;
#         index index.html;
#         
#         # Cache static assets
#         location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
#             expires 30d;
#             add_header Cache-Control "public, immutable";
#         }
#     }
# }
```

**Important:** Replace `aijohn.aintivirus.ai` with your actual domain name.

### Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/ai-john-chatbot /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 5: Setup SSL with Let's Encrypt (Recommended)

### Install Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificate

```bash
# Make sure your domain DNS points to this server first!
sudo certbot --nginx -d aijohn.aintivirus.ai -d www.aijohn.aintivirus.ai
```

Follow the prompts. Certbot will automatically:
- Obtain the certificate
- Update your nginx configuration
- Set up auto-renewal

### Verify Auto-Renewal

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run
```

### Update nginx Configuration

After SSL is set up, uncomment the HTTPS server block in your nginx config and comment out the HTTP-only block, then reload nginx:

```bash
sudo nano /etc/nginx/sites-available/ai-john-chatbot
# Make the changes mentioned above
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Firewall Configuration

### Configure UFW (Ubuntu/Debian)

```bash
# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Configure firewalld (CentOS/RHEL)

```bash
# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Step 7: Verify Deployment

### Test Application

```bash
# Check if application is running
pm2 status

# Check application logs
pm2 logs ai-john-chatbot --lines 50

# Test health endpoint
curl http://localhost:3000/health

# Test from external (replace with your domain)
curl https://aijohn.aintivirus.ai/health
```

### Test API Endpoint

```bash
curl -X POST https://aijohn.aintivirus.ai/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

### Test Widget

Visit `https://aijohn.aintivirus.ai` in your browser. You should see the widget page with the floating launcher button.

## Step 8: Monitoring & Maintenance

### View Logs

```bash
# Application logs (PM2)
pm2 logs ai-john-chatbot

# nginx access logs
sudo tail -f /var/log/nginx/ai-john-chatbot-access.log

# nginx error logs
sudo tail -f /var/log/nginx/ai-john-chatbot-error.log
```

### Update Application

```bash
cd /var/www/ai-john-chatbot

# Pull latest changes
git pull origin main

# Install new dependencies (if any)
npm install

# Rebuild
npm run build

# Restart application
pm2 restart ai-john-chatbot
```

### Backup

```bash
# Create backup script
cat > /home/$USER/backup-chatbot.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
APP_DIR="/var/www/ai-john-chatbot"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/ai-john-chatbot-$DATE.tar.gz -C $APP_DIR \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  .

# Keep only last 7 backups
ls -t $BACKUP_DIR/ai-john-chatbot-*.tar.gz | tail -n +8 | xargs rm -f
EOF

chmod +x /home/$USER/backup-chatbot.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/$USER/backup-chatbot.sh") | crontab -
```

## Troubleshooting

### Application won't start

```bash
# Check PM2 logs
pm2 logs ai-john-chatbot --err

# Check if port is in use
sudo netstat -tlnp | grep 3000

# Verify environment variables
cd /var/www/ai-john-chatbot
cat .env
```

### nginx 502 Bad Gateway

```bash
# Check if application is running
pm2 status

# Check application logs
pm2 logs ai-john-chatbot

# Verify nginx can reach the app
curl http://localhost:3000/health
```

### SSL Issues

```bash
# Check certificate expiration
sudo certbot certificates

# Renew manually if needed
sudo certbot renew

# Check nginx SSL configuration
sudo nginx -t
```

### High Memory Usage

```bash
# Monitor with PM2
pm2 monit

# Check memory limits
pm2 describe ai-john-chatbot

# Restart if needed
pm2 restart ai-john-chatbot
```

## Security Checklist

- [ ] SSL certificate installed and auto-renewal configured
- [ ] Firewall configured (only ports 22, 80, 443 open)
- [ ] `.env` file has correct permissions (600)
- [ ] `ALLOWED_ORIGINS` is set to your domain(s)
- [ ] Application runs as non-root user
- [ ] PM2 startup configured
- [ ] Regular backups configured
- [ ] Log rotation configured (optional but recommended)

## Optional: Log Rotation

Create log rotation for nginx:

```bash
sudo nano /etc/logrotate.d/ai-john-chatbot
```

Add:

```
/var/log/nginx/ai-john-chatbot-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

## Support

For issues or questions, check:
- Application logs: `pm2 logs ai-john-chatbot`
- nginx logs: `/var/log/nginx/ai-john-chatbot-error.log`
- GitHub Issues: https://github.com/Aintivirus-AI/ai-john-chatbot/issues
