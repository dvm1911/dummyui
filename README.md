# SentriCON Blueprint Webapp

UI blueprint webapp for time-series anomaly monitoring using `Cleaned_clinker_cooler_Data.xls`.

## Run

1. Build frontend data from the source file:

```bash
python3 scripts/build_blueprint_data.py
```

2. Serve the folder locally:

```bash
python3 -m http.server 8080
```

3. Open `http://localhost:8080`.

## What is included

- Overview dashboard with machine health cards and priority alerts
- Machine drill-down pages with interactive signal charts and anomaly markers
- Alerts dashboard with filtering, bulk actions, and lifecycle states
- Alert investigation view with context charts, explanation, actions, usefulness feedback, and comments
- System health page for ingestion/analytics/queue status

User actions (`status`, `usefulness`, `comments`) are persisted in browser `localStorage`.
