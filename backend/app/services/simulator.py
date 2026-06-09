from typing import List, Dict, Any
from ..models import Component, Shipment

# Define installation durations for components
INSTALLATION_DURATIONS = {
    "Excavation": 30,
    "Substation": 60,
    "Transformer": 30,
    "Switchgear": 20,
    "Generator": 25,
    "UPS": 20,
    "Chiller": 25,
    "Cooling Pump": 15,
    "GPU": 30,
    "Fiber Optics": 15,
    "Software": 15,
    "Safety": 15,
    "Security": 15
}

def simulate_schedule(
    components: List[Component],
    shipments: List[Shipment],
    manual_delays: Dict[int, int]
) -> Dict[str, Any]:
    """
    Computes early start and end days for all component installations using CPM.
    Evaluates dependencies and delivery gates.
    """
    # Create shipment map for quick lookup
    shipment_map = {s.component_id: s for s in shipments}

    # Sort components by installation sequence to guarantee dependencies are processed first
    sorted_comps = sorted(components, key=lambda c: c.installation_sequence)

    # Dictionary to keep track of results
    # id -> {"start": int, "end": int, "delivery": int}
    schedule_data = {}

    def get_cpm_dates(override_delays: Dict[int, int]) -> Dict[int, Dict[str, int]]:
        dates = {}
        for comp in sorted_comps:
            # Installation duration
            duration = INSTALLATION_DURATIONS.get(comp.category, 15)

            # Sourcing arrival day: base lead time + calculated shipment delay + manual override
            shipment = shipment_map.get(comp.id)
            shipment_delay = shipment.expected_delay_days if shipment else 0
            manual_delay = override_delays.get(comp.id, 0)
            
            delivery_day = comp.base_lead_time_days + shipment_delay + manual_delay
            # Excavation/Substation are local works starting at day 0
            if comp.category in ["Excavation", "Substation"]:
                delivery_day = 0

            # Start day is gated by dependencies and delivery arrival
            dep_ids = []
            if comp.dependencies:
                dep_names = [d.strip() for d in comp.dependencies.split(",") if d.strip()]
                # Find matching IDs of parents
                for p_comp in components:
                    if p_comp.name in dep_names:
                        dep_ids.append(p_comp.id)

            max_dep_end = 0
            for dep_id in dep_ids:
                if dep_id in dates:
                    max_dep_end = max(max_dep_end, dates[dep_id]["end"])

            start_day = max(max_dep_end, delivery_day)
            end_day = start_day + duration

            dates[comp.id] = {
                "start": start_day,
                "end": end_day,
                "delivery": delivery_day,
                "duration": duration
            }
        return dates

    # Compute base dates
    base_dates = get_cpm_dates(manual_delays)

    # Project completion baseline
    project_end_baseline = max(item["end"] for item in base_dates.values())

    # Calculate zero-delay baseline to find project slip
    zero_dates = get_cpm_dates({})
    project_end_zero = max(item["end"] for item in zero_dates.values())
    project_delay_days = project_end_baseline - project_end_zero

    # Identify Critical Path numerically:
    # A component is critical if adding 1 day of delay to its delivery day shifts the project completion date.
    critical_path_ids = set()
    for comp in sorted_comps:
        # Clone manual delays and add +1 day to this component
        test_delays = dict(manual_delays)
        test_delays[comp.id] = test_delays.get(comp.id, 0) + 1
        
        test_dates = get_cpm_dates(test_delays)
        test_project_end = max(item["end"] for item in test_dates.values())
        
        if test_project_end > project_end_baseline:
            critical_path_ids.add(comp.id)

    # Format events
    events = []
    for comp in sorted_comps:
        d = base_dates[comp.id]
        shipment = shipment_map.get(comp.id)
        
        # Sourcing delay check
        shipment_delay = shipment.expected_delay_days if shipment else 0
        manual_delay = manual_delays.get(comp.id, 0)
        total_delay = shipment_delay + manual_delay

        events.append({
            "component_id": comp.id,
            "name": comp.name,
            "category": comp.category,
            "start_day": d["start"],
            "duration_days": d["duration"],
            "end_day": d["end"],
            "is_delayed": total_delay > 0,
            "delay_days": total_delay,
            "is_critical": comp.id in critical_path_ids or comp.category == "Software" # Software is final node
        })

    # Format target date based on day count
    # Let's project start from today
    import datetime
    today = datetime.date.today()
    launch_date = (today + datetime.timedelta(days=project_end_baseline)).strftime("%B %d, %Y")

    return {
        "total_project_days": project_end_baseline,
        "project_launch_date": launch_date,
        "project_delay_days": max(project_delay_days, 0),
        "critical_path": events
    }
