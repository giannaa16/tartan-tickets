# Tartan Tickets

Club event ticketing for CMU students. Built from Starter Spec A (`../In Class Spec 10:1`).

## Status

- **Done:** Story 1, Browse events. Lists events starting in the next 7 days with date,
  location, price, and seats remaining. Sold-out events show "Sold out" and "Join waitlist".
- **Placeholders:** the Buy and Join waitlist buttons show "Coming soon".
- **Temporary shortcuts:** no database (sample events live in server memory and reset on
  restart), no sign-in, no real payments.

## Run it

```bash
npm install     # first time only
npm run dev     # then open http://localhost:3000
npm test        # run the automated tests
```

## Where things are

- `lib/events.ts`: sample events and the "upcoming" rules
- `app/api/events/route.ts`: `GET /api/events`
- `app/EventList.tsx`: the event list page (loading, empty, error, sold-out states)
- `app/globals.css`: named color tokens (ink, accent, surface)
- `tests/`: automated tests, named after the story they check (e.g. `story1_...`)
