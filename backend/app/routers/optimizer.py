from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Supplier, Shipment, Component
from ..schemas import OptimizationRequest, OptimizationResponse
from ..services.optimizer import optimize_suppliers

router = APIRouter(prefix="/optimizer", tags=["optimizer"])

@router.post("/", response_model=OptimizationResponse)
def get_sourcing_optimization(
    req: OptimizationRequest,
    db: Session = Depends(get_db)
):
    # 1. Find the current supplier for this category, if any active shipment exists
    current_supplier = None
    active_shipment = db.query(Shipment).join(Component).filter(
        Component.category == req.component_category,
        Shipment.current_status != "Delivered"
    ).first()
    
    if active_shipment:
        current_supplier = active_shipment.supplier

    # 2. Fetch all suppliers in this category
    suppliers = db.query(Supplier).filter(Supplier.category == req.component_category).all()

    # 3. Run multi-criteria optimization logic
    recommendations = optimize_suppliers(
        suppliers=suppliers,
        weight_cost=req.weight_cost,
        weight_lead_time=req.weight_lead_time,
        weight_risk=req.weight_risk,
        weight_carbon=req.weight_carbon,
        weight_tariff=req.weight_tariff,
        current_supplier_id=current_supplier.id if current_supplier else None
    )

    return {
        "current_supplier": current_supplier,
        "recommendations": recommendations
    }
