from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Component, Shipment
from ..schemas import Component as ComponentSchema
from ..services.risk_engine import calculate_shipment_risk

router = APIRouter(prefix="/components", tags=["components"])

@router.get("/", response_model=List[ComponentSchema])
def list_components(db: Session = Depends(get_db)):
    return db.query(Component).all()

@router.get("/{component_id}", response_model=ComponentSchema)
def get_component(component_id: int, db: Session = Depends(get_db)):
    comp = db.query(Component).filter(Component.id == component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
    return comp

@router.get("/{component_id}/risk")
def get_component_risk_breakdown(component_id: int, db: Session = Depends(get_db)):
    comp = db.query(Component).filter(Component.id == component_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
        
    shipment = db.query(Shipment).filter(Shipment.component_id == component_id).first()
    if not shipment:
        return {
            "component_id": component_id,
            "component_name": comp.name,
            "has_active_shipment": False,
            "delay_risk_percent": 0.0,
            "expected_delay_days": 0,
            "risk_factors": {}
        }
        
    risk_info = calculate_shipment_risk(shipment, shipment.supplier)
    
    return {
        "component_id": component_id,
        "component_name": comp.name,
        "has_active_shipment": True,
        "origin_country": shipment.origin_country,
        "port_of_entry": shipment.port_of_entry,
        "current_status": shipment.current_status,
        "delay_risk_percent": risk_info["delay_risk_percent"],
        "expected_delay_days": risk_info["expected_delay_days"],
        "risk_factors": risk_info["risk_factors"]
    }
