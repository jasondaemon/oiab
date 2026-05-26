# Development

## Run Locally

```bash
cd oiab_src
export OIAB_DATA_DIR="$PWD/data"
scripts/dev.sh
```

Open:

```text
http://localhost:8080/
```

## Useful Checks

```bash
python3 -m py_compile backend/app/*.py backend/app/gps/*.py
python3 -m json.tool config/apps.json >/dev/null
python3 -m json.tool config/map-packs.json >/dev/null
curl http://localhost:8080/api/health
curl http://localhost:8080/api/services
```

