# bitcoindiana.org

**bitcoINdiana.org** helps people find:
- **Bitcoin-accepting merchants** ([map](/merchants/))
- **Recurring Bitcoin meetups** ([map](/meetups/))

Our current focus is **Indiana** and its bordering states (**IL, KY, MI, OH**). We may expand to additional states over time.

## Data sources

### Merchants
Merchant locations are pulled from **BTC Map** (API v4) and filtered to state boundaries for accuracy near borders.

- BTC Map: https://btcmap.org/
- API: https://api.btcmap.org/

#### Merchant Contributions or Corrections
This site does **not** directly edit merchant listings. Merchant data is maintained upstream by **BTC Map** (and often sourced from **OpenStreetMap**). To add or correct a merchant:

1. Add a missing location or suggest a correction via BTC Map:  
   https://btcmap.org/add-location

2. If the listing is tied to OpenStreetMap, you may also need to correct it in OSM:  
   https://www.openstreetmap.org/

After the upstream data updates, changes should appear on bitcoINdiana.org after BTC Map refreshes (timing can vary).

### Meetups
Meetups are maintained in this repo as a simple JSON file:

- `assets/data/meetups.json`

#### Meetup Contributions or Corrections
Meetup additions and corrections are welcome.

Recommended workflow:
1. Edit `assets/data/meetups.json`
2. Open a Pull Request

See:
- `CONTRIBUTING.md`
- `assets/data/meetups.schema.md`

## Local development
Because the site uses `fetch()`, run a local server (not `file://`):

```bash
python3 -m http.server 8000
```

## Pronunciation 
We don't know how to best pronouce this portmanteau. Guess we will have to figure it out when we get invited to talk about it on a podcast.

- Bitcoin-Diana
- Bitco-Indiana
- Bitcoin-Indiana
- Bitcoin-In-Indiana
