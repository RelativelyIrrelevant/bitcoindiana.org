## Summary
Describe what you changed and why.

## Meetup affected
- Meetup `id` (if existing):
- Meetup name:

## Type of change (check one)
- [ ] Add a new recurring meetup
- [ ] Update an existing recurring meetup
- [ ] Fix venue address
- [ ] Fix venue coordinates (lat/lon)
- [ ] Fix meetup links
- [ ] Other (explain)

## Verification / sources
Please provide at least one:
- Official website:
- meetup.com link:
- X link:
- Nostr link:
- Google Maps link (venue or coordinates):

## Data checklist (please confirm)
- [ ] JSON is still valid
- [ ] `lat` and `lon` are numbers with 8+ decimal places (or I left a Maps link for maintainer)
- [ ] `states` includes the meetup’s physical `state_code`
- [ ] `cities` includes the 10 largest cities in ~25 miles and is sorted alphabetically
- [ ] Links are in the preferred order (website → meetup.com → linktree → X → Nostr → other)
