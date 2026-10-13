# Daily backup job (separate Railway cron service, schedule "0 21 * * *" = 02:00 PKT). Build context: repository root.
# pg_dump must be the SAME or a NEWER major version than the database: set the build variable PG_MAJOR to your
# Railway Postgres version (Postgres service → Settings / the "version" in its image), e.g. 17 or 18.
ARG PG_MAJOR=17
FROM postgres:${PG_MAJOR}-alpine

# curl: failure alerts (SMTP / Resend / webhook) and the heartbeat; openssl: encryption; tar: private uploads archive
RUN apk add --no-cache bash aws-cli coreutils curl openssl tar

COPY scripts/backup/backup.sh /usr/local/bin/backup.sh
RUN sed -i 's/
$//' /usr/local/bin/backup.sh && chmod +x /usr/local/bin/backup.sh

# Override the postgres image entrypoint – this container only runs the backup and exits.
ENTRYPOINT []
CMD ["/usr/local/bin/backup.sh"]
