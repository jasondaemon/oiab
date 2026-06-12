# Historic Places Overlay

OIAB can cache National Register of Historic Places spatial data as an offline GeoJSON overlay.

## Source

Default source:

`https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer`

Layers used:

- `0` - National Register of Historic Places points
- `1` - National Register of Historic Places polygons

Attribution:

`National Park Service, National Register of Historic Places / NRIS public spatial data. Historic place locations and boundaries may be approximate.`

## Cache Path

Cached output:

`/data/oiab/maps/overlays/historic/historic-places-latest.geojson`

## Configuration

Optional environment/settings:

- `OIAB_HISTORIC_PLACES_SOURCE_URL` - override the NPS ArcGIS MapServer URL.
- `OIAB_HISTORIC_PLACES_BBOX` - optional bbox filter as `minLon,minLat,maxLon,maxLat`.

The default refresh downloads both point and polygon layers.

## Notes

The source data includes approximate points and boundaries. Use the overlay for discovery and planning, not legal boundary determination.
