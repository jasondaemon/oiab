# OIAB Map Legend Reference

This directory contains original SVG redraws inspired by the supplied map legend references.

Files:

- `oiab-line-area-legend.svg` - line, road, trail, land-area, and future topo/public-land samples.
- `oiab-poi-legend.svg` - point-of-interest symbol reference panel.
- `legend-catalog.json` - machine-readable list of legend IDs, labels, and colors.

These assets are a design source for OIAB Maps v2. They are not yet wired into the MapLibre
sprite/style pipeline. Some entries intentionally target future overlays such as USGS/topo,
public lands, ski trails, powerlines, and access restrictions.

Next integration step:

1. Choose which legend entries apply to Protomaps source layers today.
2. Convert selected POI symbols into the MapLibre sprite sheet.
3. Update `frontend/maps/map-style.json` filters/colors to match the selected visual language.
4. Add future overlay-specific entries as USGS/public-land/topo layers are introduced.
