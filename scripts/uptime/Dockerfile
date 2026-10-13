# Uptime monitor (separate always-on Railway service). Build context: repository root.
# Watches SITE_URL/api/health and the home page; emails / texts the team when the site is down. See monitor.mjs.
FROM node:22-alpine
WORKDIR /app
# nodemailer: email alerts through your SMTP mailbox (same settings as the website)
# exact version (the same one the website uses – package.json), so a rebuild never pulls in an untested release
RUN npm init -y >/dev/null && npm install --no-audit --no-fund --save-exact nodemailer@10.0.15
COPY scripts/uptime/monitor.mjs ./monitor.mjs
CMD ["node", "monitor.mjs"]
