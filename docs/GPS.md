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

## Stabilization

The backend applies stationary lock and moving smoothing so the map marker does not drift while the vehicle is stopped.

