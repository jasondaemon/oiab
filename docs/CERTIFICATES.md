# Certificates

OIAB is designed to be used locally/offline, but browser APIs such as geolocation require a secure context.

Config:

```text
OIAB_HOSTNAME=overland.daemonadventures.net
OIAB_CERT_MODE=existing
OIAB_DATA_DIR=/data/oiab
```

Certificate files should live under:

```text
/data/oiab/certs
```

This first extraction includes script placeholders. Production deployment should use either:

- an existing trusted certificate copied into `/data/oiab/certs`
- a DNS-01 issued certificate for the configured hostname
- local CA/self-signed mode for development only

Do not commit private keys or API tokens.

