import datetime
from sqlalchemy.orm import Session
from .database import engine, Base, SessionLocal
from .models import Component, Supplier, Shipment, Document

def seed_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # 1. Seed Components
        # We model the build sequence: Excavation -> Substation -> Power Equipment -> HVAC/UPS -> Server Rack -> Software
        components = [
            Component(id=1, name="Site Excavation & Foundation", category="Excavation", base_lead_time_days=30, installation_sequence=1, dependencies=""),
            Component(id=2, name="20MW Power Substation", category="Substation", base_lead_time_days=60, installation_sequence=2, dependencies="Site Excavation & Foundation"),
            Component(id=3, name="High-Voltage Transformers", category="Transformer", base_lead_time_days=365, installation_sequence=3, dependencies="20MW Power Substation"),
            Component(id=4, name="Medium-Voltage Switchgear", category="Switchgear", base_lead_time_days=180, installation_sequence=3, dependencies="20MW Power Substation"),
            Component(id=5, name="2MW Backup Diesel Generators", category="Generator", base_lead_time_days=120, installation_sequence=4, dependencies="High-Voltage Transformers,Medium-Voltage Switchgear"),
            Component(id=6, name="Industrial UPS Systems", category="UPS", base_lead_time_days=90, installation_sequence=4, dependencies="High-Voltage Transformers,Medium-Voltage Switchgear"),
            Component(id=7, name="Chillers & Cooling Towers", category="Chiller", base_lead_time_days=150, installation_sequence=4, dependencies="High-Voltage Transformers"),
            Component(id=8, name="Liquid Cooling CDUs", category="Cooling Pump", base_lead_time_days=90, installation_sequence=5, dependencies="Chillers & Cooling Towers"),
            Component(id=9, name="NVIDIA H100 GPU Racks", category="GPU", base_lead_time_days=180, installation_sequence=6, dependencies="Industrial UPS Systems,Liquid Cooling CDUs"),
            Component(id=10, name="Fiber & Copper Interconnects", category="Fiber Optics", base_lead_time_days=45, installation_sequence=6, dependencies="Industrial UPS Systems"),
            Component(id=11, name="Software Commissioning & Go-Live", category="Software", base_lead_time_days=15, installation_sequence=7, dependencies="NVIDIA H100 GPU Racks,Fiber & Copper Interconnects"),
        ]
        db.add_all(components)
        db.flush()

        # 2. Seed Suppliers
        suppliers = [
            # High-Voltage Transformers
            Supplier(id=1, name="Müller Kraftwerke GmbH", category="Transformer", country="Germany", reliability_score=0.90, base_cost_usd=1200000.0, carbon_footprint_co2=45.0, tariff_exposure_pct=5.0, lead_time_days=365),
            Supplier(id=2, name="Hyundai Power Transformers", category="Transformer", country="South Korea", reliability_score=0.94, base_cost_usd=1350000.0, carbon_footprint_co2=55.0, tariff_exposure_pct=5.0, lead_time_days=390),
            Supplier(id=3, name="Voltaic Energy Solutions", category="Transformer", country="Mexico", reliability_score=0.84, base_cost_usd=1500000.0, carbon_footprint_co2=35.0, tariff_exposure_pct=0.0, lead_time_days=240),
            Supplier(id=4, name="Delta Electrical Corp", category="Transformer", country="Taiwan", reliability_score=0.88, base_cost_usd=1100000.0, carbon_footprint_co2=50.0, tariff_exposure_pct=15.0, lead_time_days=330),

            # NVIDIA H100 GPU Racks
            Supplier(id=5, name="Taiwan Microelectronics Corp (TSMC)", category="GPU", country="Taiwan", reliability_score=0.97, base_cost_usd=5000000.0, carbon_footprint_co2=120.0, tariff_exposure_pct=25.0, lead_time_days=180),
            Supplier(id=6, name="US-Silicon Foundries", category="GPU", country="USA", reliability_score=0.92, base_cost_usd=6500000.0, carbon_footprint_co2=75.0, tariff_exposure_pct=0.0, lead_time_days=120),
            Supplier(id=7, name="Nippon Semi Ltd", category="GPU", country="Japan", reliability_score=0.95, base_cost_usd=5400000.0, carbon_footprint_co2=110.0, tariff_exposure_pct=10.0, lead_time_days=210),

            # Medium-Voltage Switchgear
            Supplier(id=8, name="ABB Europe SpA", category="Switchgear", country="Italy", reliability_score=0.92, base_cost_usd=800000.0, carbon_footprint_co2=22.0, tariff_exposure_pct=5.0, lead_time_days=180),
            Supplier(id=9, name="Eaton Electrical USA", category="Switchgear", country="USA", reliability_score=0.96, base_cost_usd=950000.0, carbon_footprint_co2=18.0, tariff_exposure_pct=0.0, lead_time_days=110),
            Supplier(id=10, name="Chint Group", category="Switchgear", country="China", reliability_score=0.85, base_cost_usd=600000.0, carbon_footprint_co2=30.0, tariff_exposure_pct=25.0, lead_time_days=150),

            # Chillers & Cooling Towers
            Supplier(id=11, name="Daikin Industries", category="Chiller", country="Japan", reliability_score=0.95, base_cost_usd=400000.0, carbon_footprint_co2=28.0, tariff_exposure_pct=10.0, lead_time_days=150),
            Supplier(id=12, name="Trane Technologies", category="Chiller", country="USA", reliability_score=0.93, base_cost_usd=480000.0, carbon_footprint_co2=22.0, tariff_exposure_pct=0.0, lead_time_days=120),
            Supplier(id=13, name="Johnson Controls", category="Chiller", country="Mexico", reliability_score=0.89, base_cost_usd=420000.0, carbon_footprint_co2=25.0, tariff_exposure_pct=0.0, lead_time_days=130),

            # Industrial UPS
            Supplier(id=14, name="Schneider Electric", category="UPS", country="France", reliability_score=0.96, base_cost_usd=300000.0, carbon_footprint_co2=12.0, tariff_exposure_pct=5.0, lead_time_days=90),
            Supplier(id=15, name="Vertiv Corp", category="UPS", country="USA", reliability_score=0.94, base_cost_usd=350000.0, carbon_footprint_co2=10.0, tariff_exposure_pct=0.0, lead_time_days=75),
            
            # Generators
            Supplier(id=16, name="Cummins Inc", category="Generator", country="USA", reliability_score=0.95, base_cost_usd=500000.0, carbon_footprint_co2=35.0, tariff_exposure_pct=0.0, lead_time_days=120),
            Supplier(id=17, name="Caterpillar Power", category="Generator", country="USA", reliability_score=0.93, base_cost_usd=550000.0, carbon_footprint_co2=38.0, tariff_exposure_pct=0.0, lead_time_days=130),
            
            # Cooling Pumps
            Supplier(id=18, name="Grundfos Pumps", category="Cooling Pump", country="Denmark", reliability_score=0.97, base_cost_usd=120000.0, carbon_footprint_co2=6.0, tariff_exposure_pct=5.0, lead_time_days=90),
            
            # Fiber Optics
            Supplier(id=19, name="Corning Inc", category="Fiber Optics", country="USA", reliability_score=0.98, base_cost_usd=80000.0, carbon_footprint_co2=3.0, tariff_exposure_pct=0.0, lead_time_days=45),
        ]
        db.add_all(suppliers)
        db.flush()

        # 3. Seed Shipments (Active)
        # Note: departure dates and ETA should coordinate with their lead times
        shipments = [
            Shipment(
                id=1,
                component_id=3,  # High-Voltage Transformers
                supplier_id=1,   # Müller Kraftwerke (Germany)
                origin_country="Germany",
                destination="Dallas AI-1",
                shipping_method="Ocean",
                port_of_entry="Port of Houston",
                current_status="In Transit",
                departure_date=(datetime.date.today() - datetime.timedelta(days=20)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=345)).isoformat(),
                current_lat=46.20,
                current_lng=-32.50,
            ),
            Shipment(
                id=2,
                component_id=4,  # Switchgear
                supplier_id=8,   # ABB Europe (Italy)
                origin_country="Italy",
                destination="Dallas AI-1",
                shipping_method="Ocean",
                port_of_entry="Port of Houston",
                current_status="Customs Hold",
                departure_date=(datetime.date.today() - datetime.timedelta(days=165)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=15)).isoformat(),
                current_lat=29.75,
                current_lng=-95.08,  # Port of Houston
            ),
            Shipment(
                id=3,
                component_id=7,  # Chillers
                supplier_id=11,  # Daikin (Japan)
                origin_country="Japan",
                destination="Dallas AI-1",
                shipping_method="Ocean",
                port_of_entry="Port of Los Angeles",
                current_status="Port Congested",
                departure_date=(datetime.date.today() - datetime.timedelta(days=130)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=20)).isoformat(),
                current_lat=33.74,
                current_lng=-118.26,  # Port of LA
            ),
            Shipment(
                id=4,
                component_id=9,  # GPUs
                supplier_id=5,   # TSMC (Taiwan)
                origin_country="Taiwan",
                destination="Dallas AI-1",
                shipping_method="Ocean",
                port_of_entry="Port of Los Angeles",
                current_status="In Transit",
                departure_date=(datetime.date.today() - datetime.timedelta(days=60)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=120)).isoformat(),
                current_lat=24.5,
                current_lng=130.8,  # West Pacific Ocean
            ),
            Shipment(
                id=5,
                component_id=6,  # UPS
                supplier_id=14,  # Schneider Electric (France)
                origin_country="France",
                destination="Dallas AI-1",
                shipping_method="Ocean",
                port_of_entry="Port of Houston",
                current_status="In Transit",
                departure_date=(datetime.date.today() - datetime.timedelta(days=45)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=45)).isoformat(),
                current_lat=40.5,
                current_lng=-42.3,  # Mid Atlantic
            ),
            Shipment(
                id=6,
                component_id=5,  # Generators
                supplier_id=16,  # Cummins (USA)
                origin_country="USA",
                destination="Dallas AI-1",
                shipping_method="Road",
                port_of_entry="N/A",
                current_status="In Transit",
                departure_date=(datetime.date.today() - datetime.timedelta(days=10)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=110)).isoformat(),
                current_lat=39.8,
                current_lng=-86.1,  # Indianapolis, IN
            ),
            Shipment(
                id=7,
                component_id=8,  # CDUs
                supplier_id=18,  # Grundfos (Denmark)
                origin_country="Denmark",
                destination="Dallas AI-1",
                shipping_method="Ocean",
                port_of_entry="Port of New York",
                current_status="In Transit",
                departure_date=(datetime.date.today() - datetime.timedelta(days=25)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=65)).isoformat(),
                current_lat=49.1,
                current_lng=-10.2,  # North Atlantic
            ),
            Shipment(
                id=8,
                component_id=10, # Fiber
                supplier_id=19,  # Corning (USA)
                origin_country="USA",
                destination="Dallas AI-1",
                shipping_method="Road",
                port_of_entry="N/A",
                current_status="In Transit",
                departure_date=(datetime.date.today() - datetime.timedelta(days=5)).isoformat(),
                estimated_delivery_date=(datetime.date.today() + datetime.timedelta(days=40)).isoformat(),
                current_lat=42.1,
                current_lng=-77.0,  # Corning, NY
            )
        ]
        
        # Calculate initial risk metrics for shipments before adding them
        from .services.risk_engine import calculate_shipment_risk
        for s in shipments:
            # Find supplier matching supplier_id
            sup = next(sup for sup in suppliers if sup.id == s.supplier_id)
            risk = calculate_shipment_risk(s, sup)
            s.delay_risk_percent = risk["delay_risk_percent"]
            s.expected_delay_days = risk["expected_delay_days"]

        db.add_all(shipments)
        db.flush()

        # 4. Seed Documents (Corpus for RAG Copilot)
        documents = [
            Document(
                id=1,
                title="Müller Kraftwerke Transformer Sourcing Agreement",
                category="Contract",
                content="""Müller Kraftwerke GmbH Sourcing Agreement CLA-2024-9988.
Clause 4.2 (Delivery SLA): The supplier commits to a base fabrication and shipping lead time of 365 calendar days from formal purchase order receipt.
Clause 4.3 (Delays & Liquidated Damages): In the event of standard component delays exceeding 14 calendar days, a penalty of 0.5% of the total order value ($1,200,000) per week of delay shall apply, capped at 10%.
Clause 9.1 (Force Majeure): Force Majeure events include acts of God, war, union strikes at North Sea ports, and governmental export controls in the European Union. Geopolitical conflicts affecting European energy grids shall allow an automatic 30-day grace extension on component delivery.""",
                source_url="https://contracts.securesync.internal/sla/muller-kraftwerke-transformer.pdf"
            ),
            Document(
                id=2,
                title="Schenker Global Logistics Ocean Route Risk Assessment",
                category="Port Advisory",
                content="""Schenker Logistics Route Bulletin Q2 2026.
Geopolitical tensions in the Taiwan Strait remain elevated. Standard ocean shipments departing from Keelung Port or Kaohsiung Port face average customs screening delays of 4-6 days due to enhanced security sweeps. If naval exercises commence, detours around the Luzon Strait can add 12 days to transit, pushing total shipping lead time to Dallas via Port of Los Angeles to over 55 days.
Weather Bulletin: The typhoon season in the West Pacific is expected to peak between July and October. Cargo ships routing east from Asia to the US West Coast may face tropical storm route adjustments adding 3-7 days.
Port Congestion: The Port of Los Angeles is currently reporting a ship-to-berth delay average of 72 hours (3 days) due to automated terminal upgrades. Port of Houston is experiencing a 5-day delay due to seasonal container surges.""",
                source_url="https://logistics.securesync.internal/bulletins/schenker-q2-ocean-routes.pdf"
            ),
            Document(
                id=3,
                title="Dallas AI-1 Project Master Schedule & Dependencies",
                category="SLA",
                content="""Dallas AI-1 Project Master Schedule Summary (20MW Capacity).
Energization sequence is strictly gated by the delivery and installation of the High-Voltage 20MW Transformers.
Power sub-structure dependency: Substation excavation must complete before transformer pad pouring. The High-Voltage Transformers and Medium-Voltage Switchgear must both be fully energized before backup diesel generators or Industrial UPS units can be commissioned.
HVAC and Liquid Cooling dependencies: The main Chillers and Cooling Towers must be installed before the Liquid Cooling CDUs (Cooling Distribution Units) can begin fluid loop testing.
GPU Rack dependencies: NVIDIA H100 GPU Racks cannot be installed in the data hall until both the Industrial UPS systems (clean power) and Liquid Cooling CDUs (heat dissipation) are verified and running.
Launch gate: Final software commissioning and cluster training testing requires all GPU racks and fiber optics interconnects to be fully operational.""",
                source_url="https://pm.securesync.internal/dallas-ai-1/schedule-summary.pdf"
            ),
            Document(
                id=4,
                title="Customs and Tariff Advisory (USMCA & European Sourcing)",
                category="Geopolitical Bulletin",
                content="""US Customs and Border Protection Tariff Guide 2026.
Imported electrical transformers and heavy switchgear from European Union countries (including Germany and Italy) are subject to a base Harmonized Tariff Schedule (HTS) rate of 5.0%.
Components imported from mainland China are subject to Section 301 tariffs of 25.0% for heavy machinery and power generation products, including electrical switchgear and cooling units.
Components sourced from Mexico under the USMCA trade agreement qualify for a 0.0% tariff rate, provided that at least 60% of the regional value content originates within North America. Sourcing transformers from Mexico (e.g. Voltaic Energy Solutions) eliminates tariff exposure and shortens border customs check times to 1-2 days at Laredo.""",
                source_url="https://gov.customs.internal/tariffs/2026-electrical-machinery.pdf"
            ),
        ]
        db.add_all(documents)
        db.flush()

        # Commit all changes
        db.commit()
        print("Database pre-seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
