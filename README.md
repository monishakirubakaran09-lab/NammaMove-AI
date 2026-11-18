# NammaMove AI — Urban Emerald (corrected starter)

A self-contained **practice / portfolio prototype** of a simulated Bengaluru mobility app.
**Do not submit prewritten code to DevForge:** its rules require building the hackathon project during the event.

## Features
- Demo-only welcome/login (name/email stays in this browser session; no authentication).
- Separate Dashboard, Plan a journey, Road updates, Traffic signals, Metro & bus screens.
- User-selectable start, destination, departure time, and simulation traffic level.
- Shared simulated routes and disruptions served from FastAPI.
- Leaflet map with OpenStreetMap tiles (requires internet); route geometry is schematic.
- Responsive Urban Emerald UI. Travel estimates are illustrative, **not live routing**.

## Run from the beginning on macOS

Open the **whole `nammamove-ai` folder** in VS Code.

### Terminal A — backend
```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
Check http://127.0.0.1:8000/api/health or http://127.0.0.1:8000/docs.
If `Address already in use` appears, you may already have FastAPI running on 8000. Check the health link first. If it belongs to an old version, stop its terminal with Ctrl+C.

### Terminal B — frontend
```sh
cd frontend
npm install
npm run dev
```
Open http://127.0.0.1:5173/ and use the **demo login**.
Leave **both** terminals open.

## Why the old blank screen is fixed
`hhmm()` previously called `.split()` on an undefined value and crashed React. The corrected formatter handles missing values safely. The backend/frontend contract is also checked, and the UI includes a Retry button.

## Share temporary website preview
In VS Code > Ports, forward **5173**, set the visibility to Public, and copy its forwarded address. Make sure both servers remain running. Vite's built-in `/api` proxy forwards API requests from port 5173 to local port 8000, so **you do not need to expose port 8000 publicly**.
A public tunnel exposes this demo to anyone with the link; do not add personal or confidential data. Turn it off after the demo.

## Notes
- If Vite reports an unauthorized host over the tunnel, configure Vite's allowed hosts for your specific trusted tunnel rather than globally allowing all hosts.
- The sample incident list is in-memory and is shared between visitors connected to the same running backend.
- Session login is a UI demonstration, not secure sign-in.
- `npm audit` can be used to review dependency notices. Avoid blind breaking upgrades.


## Version 2 improvements (commuter-focused)

- Road route cards now include **estimated arrival** based on the entered departure time.
- A **disruption impact summary** on Journey and Road Updates screens shows the fastest simulated road estimate, extra minutes on the fastest route, and recommended mode.
- Metro/bus/road comparison cards show **estimated arrival** and explicit illustrative trip stages.
- Incident records include a timestamp; affected route rows show the modeled extra minutes.
- The map, color theme, navigation, and API proxy remain in place.

**Accuracy:** All network edges, journey stages, incident penalties, and travel times remain fictional demonstration data. Arrival time is just departure + simulated minutes. Do not use for actual travel decisions.

For a fresh installation, from the extracted project root, run in separate terminals:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

Then visit `http://127.0.0.1:5173/`.

The Journey form includes search boxes to filter the **nine supported demo locations**. These do not search every address in Bengaluru.
