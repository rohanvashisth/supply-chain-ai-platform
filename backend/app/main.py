import json
import asyncio
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .database import engine, Base
from .routers import dashboard, components, optimizer, simulator, copilot

# Create DB tables if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Data Center Supply Chain Risk Platform API",
    description="Backend services for predicting shipment delays, optimization, and project scheduling.",
    version="1.0.0"
)

# CORS configurations for local dev frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, lock this down
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(dashboard.router, prefix="/api")
app.include_router(components.router, prefix="/api")
app.include_router(optimizer.router, prefix="/api")
app.include_router(simulator.router, prefix="/api")
app.include_router(copilot.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "AI Data Center Supply Chain Risk Platform API",
        "endpoints": ["/api/dashboard", "/api/components", "/api/optimizer", "/api/simulator", "/api/copilot", "/events"]
    }

# SSE Streaming simulating Kafka Shipment Telemetry Events
async def kafka_event_generator():
    """Generates mock Kafka shipping events periodically."""
    shipment_names = [
        "NVIDIA H100 GPU Racks (Taiwan)",
        "20MW Power Transformer (Germany)",
        "Medium-Voltage Switchgear (Italy)",
        "Chillers & Cooling Towers (Japan)",
        "Industrial UPS Systems (France)"
    ]
    
    ports = ["Port of Los Angeles", "Port of Houston", "Port of Rotterdam"]
    statuses = ["In Transit", "Port Congested", "Customs Hold", "Customs Cleared", "Delayed"]
    
    # Send initial connection event
    yield f"data: {json.dumps({'event': 'connection', 'message': 'Subscribed to Kafka topic: supply-chain-telemetry'})}\n\n"
    
    while True:
        await asyncio.sleep(6.0) # Stream event every 6 seconds
        
        event_type = random.choice(["coordinate_update", "status_change", "customs_alert", "weather_warning"])
        shipment = random.choice(shipment_names)
        
        payload = {"event": event_type, "shipment": shipment}
        
        if event_type == "coordinate_update":
            # Shift coordinate slightly
            lat_delta = random.uniform(-0.15, 0.15)
            lng_delta = random.uniform(-0.15, 0.15)
            payload["message"] = f"GPS Telemetry update for {shipment}."
            payload["details"] = {"lat_shift": round(lat_delta, 4), "lng_shift": round(lng_delta, 4)}
            
        elif event_type == "status_change":
            new_status = random.choice(statuses)
            payload["message"] = f"Status updated for {shipment} to: {new_status}."
            payload["details"] = {"status": new_status}
            
        elif event_type == "customs_alert":
            port = random.choice(ports)
            payload["message"] = f"Customs inspection queue hold registered at {port} for {shipment}."
            payload["details"] = {"port": port, "hold_severity": "elevated"}
            
        elif event_type == "weather_warning":
            weather_event = random.choice(["Tropical Depression warning", "North Atlantic storm surge", "Dense fog delay"])
            payload["message"] = f"Weather Alert: {weather_event} affecting maritime route for {shipment}."
            payload["details"] = {"warning": weather_event, "potential_delay_hours": random.choice([12, 24, 48])}
            
        yield f"data: {json.dumps(payload)}\n\n"

@app.get("/events")
async def stream_kafka_events():
    """SSE Endpoint that client connects to for real-time Kafka streams."""
    return StreamingResponse(kafka_event_generator(), media_type="text/event-stream")
