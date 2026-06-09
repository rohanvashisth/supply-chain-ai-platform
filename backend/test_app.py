import os
import sys
from sqlalchemy.orm import Session

# Add the backend folder to pythonpath so imports resolve
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import SessionLocal
from backend.app.models import Component, Shipment, Supplier, Document
from backend.app.services.risk_engine import calculate_shipment_risk
from backend.app.services.simulator import simulate_schedule
from backend.app.services.optimizer import optimize_suppliers
from backend.app.services.copilot import answer_query

def run_tests():
    print("Starting backend logic verification tests...")
    db: Session = SessionLocal()
    
    try:
        # 1. Test Risk Engine
        print("Testing Risk Engine...")
        # Get High-Voltage Transformer Shipment
        transformer_shipment = db.query(Shipment).filter(Shipment.component_id == 3).first()
        assert transformer_shipment is not None, "Transformer shipment not found in database!"
        
        supplier = transformer_shipment.supplier
        risk_data = calculate_shipment_risk(transformer_shipment, supplier)
        
        print(f" -> Transformer Risk: {risk_data['delay_risk_percent']}% delay risk, expected {risk_data['expected_delay_days']} days delay.")
        assert risk_data["delay_risk_percent"] > 0, "Risk percentage should be calculated"
        assert risk_data["expected_delay_days"] > 0, "Expected delay days should be calculated"
        assert len(risk_data["risk_factors"]) > 0, "Risk factor breakdown should not be empty"
        print(" [OK] Risk Engine works.")

        # 2. Test Sourcing Optimizer
        print("Testing Supplier Optimizer...")
        suppliers = db.query(Supplier).filter(Supplier.category == "Transformer").all()
        assert len(suppliers) > 0, "No transformer suppliers found"
        
        # Test weighting cost and risk heavily
        recommendations = optimize_suppliers(
            suppliers=suppliers,
            weight_cost=0.5,
            weight_lead_time=0.1,
            weight_risk=0.3,
            weight_carbon=0.05,
            weight_tariff=0.05
        )
        
        print(" -> Optimized Recommendations:")
        for r in recommendations:
            print(f"    * {r['supplier'].name}: Score {r['score']}/100, Pros: {r['pros']}")
            
        assert len(recommendations) == len(suppliers), "Optimizer should rank all category suppliers"
        assert recommendations[0]["score"] > 0, "Top recommendation score should be non-zero"
        print(" [OK] Sourcing Optimizer works.")

        # 3. Test Critical Path Simulator
        print("Testing Build Impact Simulator (CPM)...")
        components = db.query(Component).all()
        shipments = db.query(Shipment).all()
        
        # Run baseline simulation
        sim_result = simulate_schedule(components, shipments, {})
        print(f" -> Project Base Days: {sim_result['total_project_days']}")
        print(f" -> Project Slip Days: {sim_result['project_delay_days']} days")
        print(f" -> Launch Date: {sim_result['project_launch_date']}")
        
        assert sim_result["total_project_days"] > 300, "Project duration should be at least lead time (365 days) + install duration"
        
        # Run simulation with an override delay on MV Switchgear (id=4) of 40 days
        override_result = simulate_schedule(components, shipments, {4: 40})
        print(f" -> Project Days with Overridden Switchgear: {override_result['total_project_days']}")
        print(f" -> Project Slip Days with Overridden Switchgear: {override_result['project_delay_days']} days")
        
        # Check critical path tags
        critical_items = [c["name"] for c in sim_result["critical_path"] if c["is_critical"]]
        print(f" -> Critical Path Components: {critical_items}")
        assert "High-Voltage Transformers" in critical_items, "Transformers should be on the critical path"
        print(" [OK] Build Impact Simulator works.")

        # 4. Test RAG Copilot QA
        print("Testing AI Copilot RAG Answer Generator...")
        # Test Query 1
        res1 = answer_query("Which components are most likely to delay Dallas AI-1?", db, components, shipments, suppliers)
        print(" -> Answer 1 Preview:")
        print("\n".join(res1["answer"].split("\n")[:4]) + "\n...")
        assert "Switchgear" in res1["answer"], "Answer should mention switchgear"
        assert len(res1["citations"]) > 0, "RAG should return citations"
        
        # Test Query 2
        res2 = answer_query("Find a lower-risk supplier for 20MW transformer capacity", db, components, shipments, suppliers)
        print(" -> Answer 2 Preview:")
        print("\n".join(res2["answer"].split("\n")[:4]) + "\n...")
        assert "Voltaic Energy Solutions" in res2["answer"], "Answer should recommend Voltaic Energy Solutions"
        
        # Test Query 3
        res3 = answer_query("What happens if Taiwan GPU shipment is delayed by 3 weeks?", db, components, shipments, suppliers)
        print(" -> Answer 3 Preview:")
        print("\n".join(res3["answer"].split("\n")[:4]) + "\n...")
        assert "21 days" in res3["answer"], "Answer should trace the 21 days delay"
        print(" [OK] AI Copilot RAG works.")

        print("\nAll backend logic verification tests completed successfully! [PASS]")

    except Exception as e:
        print(f"\n[FAIL] Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
