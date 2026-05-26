# GPS

OIAB uses USB GPS via `gpsd` as the preferred location source.

Endpoint:

```text
GET /api/location/current
```

Compatibility alias:

```text
GET /maps-location-current
```

The response includes:

- raw GPS values direct from gpsd
- stabilized values used by the map
- receiver details when gpsd exposes them
- satellite details when available

If gpsd is unavailable, the endpoint returns a clean JSON error state. Browser geolocation fallback remains a frontend behavior.

## Verify gpsd

```bash
systemctl status gpsd
gpspipe -w -n 5
curl http://localhost:8080/api/location/current
```

## Docker

Docker deployment reads host `gpsd` by default:

```text
OIAB_GPSD_HOST=host.docker.internal
OIAB_GPSD_PORT=2947
```

The root compose file maps `host.docker.internal` to Docker's host gateway. If gpsd is only listening on `127.0.0.1`, allow host-gateway access or use a later host-network/device-passthrough override.

Container verification:

```bash
docker compose --env-file config/oiab.env exec oiab-core python - <<'PY'
from backend.app.gps.gpsd import read_gpsd
print(read_gpsd())
PY
```

## Stabilization

The backend applies stationary lock and moving smoothing so the map marker does not drift while the vehicle is stopped.
