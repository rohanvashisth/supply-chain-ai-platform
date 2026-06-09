from pydantic import BaseModel, Field
from typing import List, Optional, Dict

# Component Schemas
class ComponentBase(BaseModel):
    name: str
    category: str
    base_lead_time_days: int
    installation_sequence: int
    dependencies: str
    site: str = "Dallas AI-1"

class ComponentCreate(ComponentBase):
    pass

class Component(ComponentBase):
    id: int

    class Config:
        from_attributes = True

# Supplier Schemas
class SupplierBase(BaseModel):
    name: str
    category: str
    country: str
    reliability_score: float
    base_cost_usd: float
    carbon_footprint_co2: float
    tariff_exposure_pct: float
    lead_time_days: int

class SupplierCreate(SupplierBase):
    pass

class Supplier(SupplierBase):
    id: int

    class Config:
        from_attributes = True

# Shipment Schemas
class ShipmentBase(BaseModel):
    component_id: int
    supplier_id: int
    origin_country: str
    destination: str
    shipping_method: str
    port_of_entry: str
    current_status: str
    departure_date: str
    estimated_delivery_date: str
    current_lat: float
    current_lng: float

class ShipmentCreate(ShipmentBase):
    pass

class Shipment(ShipmentBase):
    id: int
    delay_risk_percent: float
    expected_delay_days: int
    component: Component
    supplier: Supplier

    class Config:
        from_attributes = True

# Document Schemas
class DocumentBase(BaseModel):
    title: str
    category: str
    content: str
    source_url: Optional[str] = None

class Document(DocumentBase):
    id: int

    class Config:
        from_attributes = True

# API Request/Response Schemas
class SimulationRequest(BaseModel):
    # Map of component_id to user-overridden delay days
    manual_delays: Dict[int, int] = Field(default_factory=dict)

class CriticalPathEvent(BaseModel):
    component_id: int
    name: str
    category: str
    start_day: int
    duration_days: int
    end_day: int
    is_delayed: bool
    delay_days: int
    is_critical: bool

class SimulationResult(BaseModel):
    total_project_days: int
    project_launch_date: str
    project_delay_days: int
    critical_path: List[CriticalPathEvent]

class OptimizationRequest(BaseModel):
    component_category: str
    weight_cost: float = 0.3
    weight_lead_time: float = 0.3
    weight_risk: float = 0.2
    weight_carbon: float = 0.1
    weight_tariff: float = 0.1

class OptimizedSupplierRecommendation(BaseModel):
    supplier: Supplier
    score: float  # Score out of 100
    estimated_lead_time_days: int
    estimated_cost_usd: float
    carbon_footprint_co2: float
    tariff_exposure_pct: float
    pros: List[str]
    cons: List[str]

class OptimizationResponse(BaseModel):
    current_supplier: Optional[Supplier] = None
    recommendations: List[OptimizedSupplierRecommendation]

class CopilotQuery(BaseModel):
    query: str

class Citation(BaseModel):
    title: str
    category: str
    snippet: str
    relevance_score: float

class CopilotResponse(BaseModel):
    answer: str
    citations: List[Citation]
