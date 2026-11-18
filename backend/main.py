"""NammaMove: a clearly-labelled simulated Bengaluru mobility demo."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from itertools import islice
from typing import Literal
from uuid import uuid4

import networkx as nx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="NammaMove Demo API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Coordinates locate real places, but links and all travel estimates are fictional.
PLACES = {
    "indiranagar": {"name": "Indiranagar", "lat": 12.9784, "lng": 77.6408},
    "ulsoor": {"name": "Ulsoor", "lat": 12.9812, "lng": 77.6285},
    "trinity": {"name": "Trinity", "lat": 12.9731, "lng": 77.6199},
    "mgroad": {"name": "MG Road", "lat": 12.9756, "lng": 77.6067},
    "vidhana": {"name": "Vidhana Soudha", "lat": 12.9795, "lng": 77.5913},
    "majestic": {"name": "Majestic", "lat": 12.9767, "lng": 77.5726},
    "domlur": {"name": "Domlur", "lat": 12.9612, "lng": 77.6387},
    "richmond": {"name": "Richmond Town", "lat": 12.9634, "lng": 77.6070},
    "townhall": {"name": "Town Hall", "lat": 12.9633, "lng": 77.5850},
}

ROAD_LIST = [
    ("indiranagar", "ulsoor", 5),
    ("ulsoor", "trinity", 4),
    ("trinity", "mgroad", 4),
    ("mgroad", "vidhana", 4),
    ("vidhana", "majestic", 6),
    ("indiranagar", "domlur", 6),
    ("domlur", "richmond", 10),
    ("richmond", "townhall", 7),
    ("townhall", "majestic", 7),
    ("trinity", "richmond", 8),
    ("mgroad", "richmond", 8),
    ("vidhana", "townhall", 8),
]

GRAPH = nx.Graph()
for a, b, mins in ROAD_LIST:
    GRAPH.add_edge(a, b, minutes=mins)

SEGMENTS = [
    {"id": f"{a}:{b}", "from": a, "to": b, "label": f"{PLACES[a]['name']} → {PLACES[b]['name']}", "base_minutes": mins}
    for a, b, mins in ROAD_LIST
]

INCIDENT_TYPES = {"breakdown": {"label": "Vehicle breakdown", "penalty": 13}, "roadwork": {"label": "Roadworks", "penalty": 9}, "waterlogging": {"label": "Waterlogging", "penalty": 17}}
incidents: list[dict] = []
flow_level: Literal["normal", "busy", "peak"] = "busy"
FLOW_FACTOR = {"normal": 1.0, "busy": 1.2, "peak": 1.45}


class IncidentRequest(BaseModel):
    segment_id: str
    kind: Literal["breakdown", "roadwork", "waterlogging"] = "breakdown"


class SimulationRequest(BaseModel):
    flow: Literal["normal", "busy", "peak"]


def get_weight(a: str, b: str, base: float) -> float:
    # Every module uses this one traffic model.
    penalty = sum(item["penalty"] for item in incidents if {item["from"], item["to"]} == {a, b})
    return round(base * FLOW_FACTOR[flow_level] + penalty, 2)


def routes(origin: str = "indiranagar", destination: str = "majestic") -> list[dict]:
    weighted = nx.Graph()
    for a, b, data in GRAPH.edges(data=True):
        weighted.add_edge(a, b, minutes=get_weight(a, b, data["minutes"]))
    paths = nx.shortest_simple_paths(weighted, origin, destination, weight="minutes")
    output = []
    for path in islice(paths, 3):
        minutes = round(sum(weighted[a][b]["minutes"] for a, b in zip(path, path[1:])))
        baseline_minutes = round(sum(GRAPH[a][b]["minutes"] * FLOW_FACTOR[flow_level] for a, b in zip(path, path[1:])))
        delay_minutes = max(0, minutes - baseline_minutes)
        involved = sum(1 for item in incidents if any({item["from"], item["to"]} == {a, b} for a, b in zip(path, path[1:])))
        output.append({"id": f"route-{len(output)+1}", "nodes": path, "names": [PLACES[n]["name"] for n in path], "minutes": minutes, "baseline_minutes": baseline_minutes, "incident_delay_minutes": delay_minutes, "affected_incidents": involved, "reliability": max(45, 92 - (len(path)-2)*3 - involved*23 - (12 if flow_level == "peak" else 5 if flow_level == "busy" else 0))})
    return output


def signals() -> list[dict]:
    # Simplified illustrative wait-time model, NOT real signal optimisation.
    values = {"normal": (34, 25), "busy": (51, 35), "peak": (72, 47)}
    fixed, adaptive = values[flow_level]
    return [{"id": key, "name": PLACES[key]["name"], "fixed_wait": fixed + delta, "adaptive_wait": adaptive + round(delta * 0.6), "description": "Estimated average wait in seconds"} for key, delta in [("trinity", 0), ("mgroad", 7), ("vidhana", -4)]]


def metro_options(best_road_minutes: int, origin: str, destination: str) -> list[dict]:
    # Simplified illustration; metro is offered only for corridors with sample metro coverage.
    metro_nodes = {"indiranagar", "ulsoor", "trinity", "mgroad", "vidhana", "majestic"}
    metro = {"normal": 27, "busy": 29, "peak": 32}[flow_level]
    bus = {"normal": 37, "busy": 46, "peak": 58}[flow_level]
    choices = [{"mode": "Road journey", "minutes": best_road_minutes, "note": "Best simulated road route", "kind": "road"}, {"mode": "Bus + walk", "minutes": bus, "note": "Illustrative bus journey; not a live timetable", "kind": "bus"}]
    if origin in metro_nodes and destination in metro_nodes:
        # Scale sample estimates roughly by the number of edges; not a real timetable.
        stops = nx.shortest_path_length(GRAPH.subgraph(metro_nodes), origin, destination)
        choices.append({"mode": "Metro + walk", "minutes": round(8 + stops * (metro - 8) / 5), "note": "Illustrative metro and walking estimate; not live scheduling", "kind": "metro"})
    # Approximate journey stages; these are demonstration assumptions, not transit schedules.
    for choice in choices:
        if choice["kind"] == "road":
            choice["steps"] = [f"Start at {PLACES[origin]['name']}", "Follow selected road route", f"Arrive at {PLACES[destination]['name']}"]
        elif choice["kind"] == "metro":
            choice["steps"] = ["Walk to the sample metro corridor", "Ride the sample metro connection", "Walk from the station to your destination"]
        else:
            choice["steps"] = ["Walk to a sample bus stop", "Take the illustrative bus connection", "Walk to your destination"]
    return choices


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/overview")
def overview(origin: str = "indiranagar", destination: str = "majestic", departure: str = "09:00"):
    if origin not in PLACES or destination not in PLACES:
        raise HTTPException(status_code=400, detail="Choose locations from the supported demo stops")
    if origin == destination:
        raise HTTPException(status_code=400, detail="Start and destination must be different")
    try:
        datetime.strptime(departure, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Departure must be HH:MM")
    current_routes = routes(origin, destination)
    options = sorted(metro_options(current_routes[0]["minutes"], origin, destination), key=lambda x: x["minutes"])
    departure_datetime = datetime.strptime(departure, "%H:%M")
    for route in current_routes:
        route["arrival"] = (departure_datetime + timedelta(minutes=route["minutes"])).strftime("%H:%M")
    for choice in options:
        choice["arrival"] = (departure_datetime + timedelta(minutes=choice["minutes"])).strftime("%H:%M")
    return {"app_name": "NammaMove", "demo": True, "origin": PLACES[origin]["name"], "destination": PLACES[destination]["name"], "origin_id": origin, "destination_id": destination, "departure": departure, "places": PLACES, "segments": SEGMENTS, "roads": [{"from": a, "to": b} for a, b, _ in ROAD_LIST], "flow": flow_level, "routes": current_routes, "incidents": incidents, "signals": signals(), "journeys": options, "recommendation": options[0], "updated_at": datetime.now(timezone.utc).isoformat(), "disclaimer": "Illustrative simulation only. Not live traffic, official public transit data, or real road geometry."}


@app.post("/api/incidents", status_code=201)
def add_incident(request: IncidentRequest):
    segment = next((seg for seg in SEGMENTS if seg["id"] == request.segment_id), None)
    if not segment:
        raise HTTPException(status_code=400, detail="Choose a valid road segment")
    if any(item["segment_id"] == request.segment_id for item in incidents):
        raise HTTPException(status_code=409, detail="That road already has an active incident")
    kind = INCIDENT_TYPES[request.kind]
    record = {"id": str(uuid4()), "segment_id": segment["id"], "from": segment["from"], "to": segment["to"], "location": segment["label"], "kind": request.kind, "label": kind["label"], "penalty": kind["penalty"], "created_at": datetime.now(timezone.utc).isoformat()}
    incidents.append(record)
    return record


@app.delete("/api/incidents/{incident_id}")
def remove_incident(incident_id: str):
    for idx, incident in enumerate(incidents):
        if incident["id"] == incident_id:
            incidents.pop(idx)
            return {"removed": True}
    raise HTTPException(status_code=404, detail="Incident not found")


@app.post("/api/simulation")
def set_simulation(request: SimulationRequest):
    global flow_level
    flow_level = request.flow
    return {"flow": flow_level}


@app.post("/api/reset")
def reset():
    global flow_level
    incidents.clear()
    flow_level = "busy"
    return {"reset": True}
