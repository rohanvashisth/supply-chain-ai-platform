from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Component, Shipment, Supplier
from ..schemas import CopilotQuery, CopilotResponse
from ..services.copilot import answer_query

router = APIRouter(prefix="/copilot", tags=["copilot"])

@router.post("/", response_model=CopilotResponse)
def query_procurement_copilot(
    req: CopilotQuery,
    db: Session = Depends(get_db)
):
    components = db.query(Component).all()
    shipments = db.query(Shipment).all()
    suppliers = db.query(Supplier).all()

    # Answer query using pre-seeded document database and active logistics statuses
    response_data = answer_query(
        query=req.query,
        db_session=db,
        components=components,
        shipments=shipments,
        suppliers=suppliers
    )
    
    return response_data
