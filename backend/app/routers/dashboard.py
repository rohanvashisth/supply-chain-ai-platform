from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Component, Shipment, Supplier
from ..services.risk_engine import calculate_shipment_risk
from ..services.simulator import simulate_schedule

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/")
def get_dashboard_summary(db: Session = Depends(get_db)):
    # 1. Fetch all components and shipments
    components = db.query(Component).all()
    shipments = db.query(Shipment).all()

    # 2. Update delay risk metrics in DB dynamically on each dashboard load
    for s in shipments:
        risk_data = calculate_shipment_risk(s, s.supplier)
        s.delay_risk_percent = risk_data["delay_risk_percent"]
        s.expected_delay_days = risk_data["expected_delay_days"]
    db.commit()

    # 3. Calculate baseline simulation date (no manual overrides)
    sim_result = simulate_schedule(components, shipments, {})

    # 4. Process metrics and generate alert messages
    total_components = len(components)
    delayed_count = 0
    total_delay_days = 0
    alerts = []

    for s in shipments:
        if s.expected_delay_days > 0:
            delayed_count += 1
            total_delay_days += s.expected_delay_days
            
            comp_name = s.component.name if s.component else "Unknown Component"
            
            if s.current_status == "Customs Hold":
                alerts.append({
                    "severity": "critical",
                    "component": comp_name,
                    "message": f"Customs Hold: {comp_name} held at {s.port_of_entry}. Expected delay: {s.expected_delay_days} days."
                })
            elif s.current_status == "Port Congested":
                alerts.append({
                    "severity": "warning",
                    "component": comp_name,
                    "message": f"Port Congested: {comp_name} stuck outside {s.port_of_entry}. Expected delay: {s.expected_delay_days} days."
                })
            elif s.expected_delay_days >= 15:
                alerts.append({
                    "severity": "critical",
                    "component": comp_name,
                    "message": f"Severe Transit Delay: {comp_name} from {s.origin_country} delayed by {s.expected_delay_days} days."
                })
            else:
                alerts.append({
                    "severity": "warning",
                    "component": comp_name,
                    "message": f"Transit Delay: {comp_name} is delayed by {s.expected_delay_days} days."
                })

    average_delay = round(total_delay_days / delayed_count, 1) if delayed_count > 0 else 0.0

    # Sort alerts: critical first
    alerts.sort(key=lambda x: x["severity"] == "critical", reverse=True)

    return {
        "metrics": {
            "total_components": total_components,
            "delayed_components": delayed_count,
            "average_delay_days": average_delay,
            "project_delay_days": sim_result["project_delay_days"],
            "projected_launch_date": sim_result["project_launch_date"]
        },
        "alerts": alerts,
        "shipments": [
            {
                "id": s.id,
                "component_id": s.component_id,
                "component_name": s.component.name,
                "category": s.component.category,
                "supplier_name": s.supplier.name,
                "origin": s.origin_country,
                "destination": s.destination,
                "shipping_method": s.shipping_method,
                "port_of_entry": s.port_of_entry,
                "status": s.current_status,
                "delay_risk_percent": s.delay_risk_percent,
                "expected_delay_days": s.expected_delay_days,
                "current_lat": s.current_lat,
                "current_lng": s.current_lng,
                "departure_date": s.departure_date,
                "estimated_delivery_date": s.estimated_delivery_date
            }
            for s in shipments
        ]
    }
