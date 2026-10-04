# Motion CAD MVP

A local-first TypeScript CAD interaction prototype for Ultraleap / Leap Motion Controller.

## Run

1. Confirm Ultraleap Tracking Software is running and the controller is visible in the Ultraleap Control Panel.
2. Install dependencies with `npm install`.
3. Start both the tracking bridge and web client with `npm run dev`.
4. Open `http://localhost:5173` in Chrome. The server listens on all local interfaces, so another device on the same LAN can use `http://<this-mac-ip>:5173`.

On macOS, the bridge compiles a tiny adapter against the LeapC SDK installed inside the Ultraleap app and exposes a deliberately small, app-owned protocol at `ws://127.0.0.1:8081`. Set `LEAP_SOURCE=websocket` to use the legacy Ultraleap WebSocket service at `ws://127.0.0.1:6437/v7.json` instead.

## Interaction

- Mouse: click the box to select; drag to orbit; scroll to zoom.
- Controller: pinch the box body to move it. To resize, hold a flat palm with the four fingers tightly together near a colored face plane, then push or pull along its axis. Spreading any adjacent fingers beyond the release threshold exits surface mode immediately; the opposite face stays anchored.
- Hand roles: only the right hand can move or reshape the object. Pinch with the left hand to engage view control; move it horizontally or vertically to orbit, and forward or backward to zoom. Both roles can remain active without switching modes or cancelling each other.

## Architecture

- `bridge/`: local adapter for the Ultraleap tracking service. No gesture or CAD logic.
- `src/tracking/`: browser connection and diagnostic state.
- `src/gestures/`: tracking-frame to semantic gesture events with hysteresis.
- `src/cad/`: semantic gesture to CAD state commands.
- `src/components/`: Three.js visualization only.

Environment overrides: `LEAP_URL` changes the upstream service URL and `BRIDGE_PORT` changes the local bridge port.
