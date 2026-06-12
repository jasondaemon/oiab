# OIAB Map Icon Set

OIAB map markers use a consistent badge style:

- Thin black circular outline
- Solid source/category color fill
- Black SVG glyph centered inside the circle
- Glyph should be simple, filled, high contrast, and readable at small map sizes

Preferred SVG requirements:

- Square or near-square `viewBox`
- No embedded attribution text inside the SVG
- No baked circular marker/background unless the icon itself requires it
- Solid black fill preferred
- Avoid thin strokes, small internal details, and large transparent padding

Attribution belongs in `frontend/maps/icons/noun/attribution.txt` and `docs/ATTRIBUTIONS.md`, not inside the SVG files.

## Installed Canonical Icons

These filenames are stable replacement targets under `frontend/maps/icons/noun/`.

| File | Used For |
| --- | --- |
| `airport.svg` | Airport / aerodrome |
| `alpine-hut.svg` | Alpine hut / cabin / chalet |
| `amphitheater.svg` | Amphitheater |
| `atm.svg` | ATM |
| `attraction.svg` | Attraction |
| `bakery.svg` | Bakery |
| `bank.svg` | Bank |
| `bar.svg` | Bar |
| `beach.svg` | Beach |
| `cafe.svg` | Cafe / coffee |
| `campground.svg` | Established campground |
| `campsite.svg` | Campsite / dispersed camp |
| `cave.svg` | Cave entrance |
| `church.svg` | Church / place of worship |
| `fast-food.svg` | Fast food |
| `fuel.svg` | Fuel / gas / EV charging |
| `garden.svg` | Garden |
| `grocery.svg` | Grocery / supermarket / convenience |
| `hospital.svg` | Hospital / clinic / medical |
| `hotel.svg` | Hotel / motel / lodging |
| `house.svg` | Home / house waypoint |
| `library.svg` | Library |
| `mountain.svg` | Peak / summit |
| `museum.svg` | Museum |
| `parking.svg` | Parking |
| `pharmacy.svg` | Pharmacy |
| `picnic-area.svg` | Picnic area |
| `playground.svg` | Playground |
| `police-station.svg` | Police station |
| `post-office.svg` | Post office / mail |
| `ranger-station.svg` | Ranger station |
| `restaurant.svg` | Restaurant |
| `rv-camping.svg` | RV camping |
| `school.svg` | School |
| `shop.svg` | Shop / shopping |
| `theatre.svg` | Theater / theatre |
| `toilet.svg` | Restrooms / toilet |
| `trailhead.svg` | Trailhead |
| `train.svg` | Train station |
| `viewpoint.svg` | Viewpoint / lookout |
| `water.svg` | Drinking water / water pump |
| `waterfall.svg` | Waterfall |

## Still Needed For Full Legacy Coverage

The base map and waypoint system can reference these categories. If no Noun-style icon exists, OIAB falls back to the older legacy SVG.

| Suggested File | Used For |
| --- | --- |
| `bicycle-parking.svg` | Bicycle parking |
| `bike-shop.svg` | Bike shop |
| `bus-station.svg` | Bus station / bus stop |
| `cinema.svg` | Cinema |
| `college-university.svg` | College / university |
| `dog-park.svg` | Dog park |
| `ferry-terminal.svg` | Ferry terminal |
| `fire-station.svg` | Fire station |
| `golf-course.svg` | Golf course |
| `hotspring.svg` | Hot spring |
| `information.svg` | Generic information / unknown POI |
| `lighthouse.svg` | Lighthouse |
| `marina.svg` | Marina |
| `mine-quarry.svg` | Mine / quarry |
| `outdoor-store.svg` | Outdoor store |
| `pub-brewery.svg` | Pub / brewery |
| `shelter.svg` | Shelter |
| `ski-area.svg` | Ski area |
| `spring.svg` | Spring |
| `swimming-area.svg` | Swimming area |
| `theme-park.svg` | Theme park |
| `visitor-center.svg` | Visitor center |
| `volcano.svg` | Volcano |
| `zoo.svg` | Zoo |
