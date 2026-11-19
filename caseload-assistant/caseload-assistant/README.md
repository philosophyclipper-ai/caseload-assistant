# Caseload Assistant (demo)

An AI-assisted caseload tool for Scottish estate agents. This is a hands-on demo: it runs entirely in the browser with sample data and rule-based sample AI replies, so nothing is sent anywhere.

## Pages

- **Home**: type a couple of sentences and get proposed calendar entries, emails (seller, buyer, internal legal, corporate) and weekly check-ins. Every output can be refined with a follow-up instruction.
- **Diary**: yesterday, today and the next three days, quick reminders, weekly check-ins and upcoming tasks.
- **Caseload**: your properties with seller voice, seller context, a diary of viewings and check-ins, talking points, and pre-market research from the home report.

## How it connects (without company APIs)

- "Add to calendar" downloads an `.ics` file to open in Outlook or Google Calendar.
- "Approve" downloads an `.eml` file marked as unsent, which Outlook opens as a draft.
- The website sweep is simulated with sample listings. A real sweep needs the firm's permission.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Import the repo into Vercel. It is detected as a Vite app, so no settings are needed.

## Next step

Swap the functions in `src/lib/agent.js` for Claude calls. They already take and return the same shapes a model call would.
