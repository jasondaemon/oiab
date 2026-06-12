# OIAB Data Sources and Attributions

OIAB combines local user data, public geospatial data, optional third-party overlay feeds, and icon assets. Keep this attribution file with redistributed builds and exported documentation.

## Base Map

- OpenStreetMap contributors: base map data. See <https://www.openstreetmap.org/copyright>.
- Protomaps: PMTiles-compatible OpenStreetMap distribution and map tooling. See <https://protomaps.com/>.
- MapLibre: browser map renderer. See <https://maplibre.org/>.

## Overlay Data

- Bureau of Land Management (BLM): Surface Management Agency and wilderness overlay data. See <https://www.blm.gov/>.
- PAD-US / USGS GAP: protected-area overlay data. See <https://www.usgs.gov/programs/gap-analysis-project/science/protected-areas>.
- USGS National Map / 3DEP: topographic, DEM, and contour source data. See <https://www.usgs.gov/programs/national-geospatial-program/national-map>.
- NOAA / National Weather Service: weather alerts, forecasts, radar, and related online services. See <https://www.weather.gov/documentation/services-web-api>.
- NASA FIRMS: active fire / hotspot data. See <https://firms.modaps.eosdis.nasa.gov/>.
- Recreation.gov RIDB: recreation sites and facility data when configured. See <https://ridb.recreation.gov/>.
- Campflare: campground and camping availability data when configured by the user. Attribution: "Campground data powered by Campflare" with a link to <https://campflare.com/>.

## Icon Assets

Selected POI and overlay symbols use Noun Project SVG icons under Creative Commons BY 3.0. The source attribution list is stored at:

`frontend/maps/icons/noun/attribution.txt`

The icons are normalized for map rendering by removing visible footer text from the SVG artwork. Attribution is preserved here and in the Settings -> Data & Attributions section.

## User Data

Imported GPX, GeoJSON, KML, PDF maps, media libraries, and manually added waypoints remain user-owned content. OIAB does not add attribution requirements to user-provided data.
