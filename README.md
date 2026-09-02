# Weather-Schedule

A small PWA that combines hourly weather with a built-in schedule. It is designed to resemble the simple three-column schedule layout from the reference screenshot.

## Features

- Hour-by-hour weather from Open-Meteo
- Built-in local schedule — no Google account or Google Cloud required
- Add, edit, and delete events
- Recurrence options: does not repeat, every day, every week, every 2 weeks (biweekly), every month, or every year
- Recurring events use the event's start date as the recurrence anchor
- Existing weekly events from the previous version are migrated automatically
- Location search and persistence
- PWA install support

## Run it

```bash
npm install
npm run dev
```

You only need to run `npm install` once for each fresh copy of the project. After that, use `npm run dev` whenever you want to launch the development server.

## Add a schedule event

Click **+ Add Event**. Enter the event name, choose its start date, select a repeat option, and set the start/end time.

Examples:

- **Every day:** appears every day starting on the selected date.
- **Every week:** appears every 7 days on the same weekday.
- **Every 2 weeks:** appears every 14 days on the same weekday.
- **Every month:** appears on the same day of the month.
- **Every year:** appears on the same month/day each year.
- **Does not repeat:** appears only on the selected date.

Your schedule is stored locally in your browser, so this version does not need Google OAuth, Google Cloud, API credentials, or billing.

## Weather attribution

Weather data is provided by Open-Meteo.
