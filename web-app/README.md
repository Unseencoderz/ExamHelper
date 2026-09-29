# ExamHelper — Web App

React + TypeScript + Vite + Tailwind CSS frontend for the ExamHelper backend.

## Setup

```bash
cd web-app
npm install
npm run build     # builds to web-app/dist/ which the backend serves
```

## Development

Start the backend first (port 3000), then:

```bash
npm run dev       # starts Vite dev server on port 5173 with proxy to backend
```

All `/screenshots`, `/archive`, `/snippets`, `/clipboard`, `/config`, `/auth`, `/stats`,
`/desktop-status`, and `/socket.io` requests are proxied to `http://localhost:3000`.
