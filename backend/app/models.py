from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class Component(Base):
    __tablename__ = "components"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String)  # GPU, Transformer, Switchgear, Chiller, UPS, Generator, Cooling Pump, Fiber Optics
    base_lead_time_days = Column(Integer)
    installation_sequence = Column(Integer)  # Lower is earlier in data center build sequence
    dependencies = Column(String)  # Comma-separated list of component names or IDs it depends on
    site = Column(String, default="Dallas AI-1")

    shipments = relationship("Shipment", back_populates="component")

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String)  # Component categories they can supply
    country = Column(String)
    reliability_score = Column(Float)  # 0.0 to 1.0 (historical performance)
    base_cost_usd = Column(Float)  # Cost in USD
    carbon_footprint_co2 = Column(Float)  # CO2 index in tons per unit
    tariff_exposure_pct = Column(Float)  # Tariff percentage (e.g., 25.0 for 25% tariff)
    lead_time_days = Column(Integer)  # Sourcing lead time from order to departure

    shipments = relationship("Shipment", back_populates="supplier")

class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    origin_country = Column(String)
    destination = Column(String)  # e.g., "Dallas AI-1"
    shipping_method = Column(String)  # Ocean, Air, Rail, Road
    port_of_entry = Column(String)  # Port of Los Angeles, Port of Houston, etc.
    current_status = Column(String)  # In Transit, Customs Hold, Port Congested, Delayed, Delivered
    departure_date = Column(String)  # ISO Date YYYY-MM-DD
    estimated_delivery_date = Column(String)  # ISO Date YYYY-MM-DD
    current_lat = Column(Float)
    current_lng = Column(Float)
    
    # Risk calculation fields
    delay_risk_percent = Column(Float, default=0.0)
    expected_delay_days = Column(Integer, default=0)

    component = relationship("Component", back_populates="shipments")
    supplier = relationship("Supplier", back_populates="shipments")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    category = Column(String)  # SLA, Contract, Port Advisory, Geopolitical Bulletin
    content = Column(Text)
    source_url = Column(String)
