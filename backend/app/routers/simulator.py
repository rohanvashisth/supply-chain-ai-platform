from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Component, Shipment
from ..schemas import SimulationRequest, SimulationResult
from ..services.simulator import simulate_schedule

router = APIRouter(prefix="/simulator", tags=["simulator"])

@router.post("/", response_model=SimulationResult)
def run_timeline_simulation(
    req: SimulationRequest,
    db: Session = Depends(get_db)
):
    components = db.query(Component).all()
    shipments = db.query(Shipment).all()

    # Calculate schedule including the manual delays passed from the frontend sliders
    result = simulate_schedule(
        components=components,
        shipments=shipments,
        manual_delays=req.manual_delays
    )
    
    return result
