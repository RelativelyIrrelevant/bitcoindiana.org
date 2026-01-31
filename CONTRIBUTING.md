# Contributing to bitcoindiana.org

Thanks for helping improve bitcoindiana.org.

This site is hosted via GitHub Pages. Merchant data comes from BTC Map, and meetup data is stored locally in this repository as JSON.

## What you can contribute
- Add a new meetup to `assets/data/meetups.json`
- Fix or update an existing meetup (schedule, venue, links, etc.)

## How to submit a change (recommended: Pull Request)
1. Open the meetups file:
   - https://github.com/RelativelyIrrelevant/bitcoindiana.org/blob/main/assets/data/meetups.json
2. Click the ✏️ pencil icon (Edit).
3. GitHub will prompt you to create a fork (a copy of the repo under your account). Accept.
4. Make your changes and **Commit changes**.
5. Click **Propose changes** → **Create pull request**.

After you open a PR (pull request):
- The site owner will review it and may request adjustments.
- Once merged, the update will be published to the live site shortly after.

## Data format rules (meetups.json)
Please follow:
- `assets/data/meetups.schema.md` (human-friendly schema, acceptable values, examples)

### Key rules (summary)
- JSON must remain valid (a single array of meetup objects).
- Keep `id` stable once created (it’s a permanent identifier).
- Use real coordinates:
  - `lat` and `lon` must be numbers
  - Prefer **8+ decimal places**
- `states` is for border relevance:
  - Always include the meetup’s `state_code` in `states`.
  - Add additional state codes **only** if the meetup meaningfully serves that neighboring state (e.g. Cincinnati meetup held in KY but serves OH).
- `cities` is for search:
  - Include the **10 largest cities in a ~25 mile radius** (approximate is OK).
  - Sort `cities` in **alphabetical order**.
- Links are optional but ordered.

## Tips for contributors
- If you don’t know lat/lon, find the location in Google Maps, right-click the location, and copy what Google Maps provides you.
- If a venue is private, keep an approximate location and note it in `notes`.

## Code of conduct / moderation
Meetups should be:
- recurring or regularly scheduled
- Bitcoin-focused
- respectful and non-spam

The maintainer may decline PRs that are clearly incorrect, spammy, or not meet the site’s scope.
