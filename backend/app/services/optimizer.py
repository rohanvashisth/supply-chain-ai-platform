from typing import List, Dict, Any
from ..models import Supplier
from ..schemas import OptimizedSupplierRecommendation

def optimize_suppliers(
    suppliers: List[Supplier],
    weight_cost: float,
    weight_lead_time: float,
    weight_risk: float,
    weight_carbon: float,
    weight_tariff: float,
    current_supplier_id: int = None
) -> List[Dict[str, Any]]:
    """
    Evaluates and ranks suppliers based on weighted scores of Cost, Lead Time, Risk,
    Carbon Footprint, and Tariff Exposure.
    """
    if not suppliers:
        return []

    # Normalize weights
    total_weight = weight_cost + weight_lead_time + weight_risk + weight_carbon + weight_tariff
    if total_weight == 0:
        weight_cost = weight_lead_time = weight_risk = weight_carbon = weight_tariff = 0.2
        total_weight = 1.0
        
    w_cost = weight_cost / total_weight
    w_time = weight_lead_time / total_weight
    w_risk = weight_risk / total_weight
    w_carbon = weight_carbon / total_weight
    w_tariff = weight_tariff / total_weight

    # Find boundaries for normalization
    costs = [s.base_cost_usd for s in suppliers]
    lead_times = [s.lead_time_days for s in suppliers]
    carbons = [s.carbon_footprint_co2 for s in suppliers]
    tariffs = [s.tariff_exposure_pct for s in suppliers]

    min_cost, max_cost = min(costs), max(costs)
    min_time, max_time = min(lead_times), max(lead_times)
    min_carbon, max_carbon = min(carbons), max(carbons)
    min_tariff, max_tariff = min(tariffs), max(tariffs)

    # Country geopolitical risk factor (1.0 = safe, 0.0 = high risk)
    country_risk_map = {
        "USA": 0.95,
        "Mexico": 0.90,
        "Germany": 0.85,
        "France": 0.85,
        "Italy": 0.85,
        "Denmark": 0.85,
        "Japan": 0.80,
        "South Korea": 0.80,
        "Taiwan": 0.65,
        "China": 0.45,
    }

    results = []

    for s in suppliers:
        # 1. Cost Score (Lower cost is better)
        if max_cost == min_cost:
            score_cost = 1.0
        else:
            score_cost = 1.0 - ((s.base_cost_usd - min_cost) / (max_cost - min_cost))

        # 2. Lead Time Score (Lower lead time is better)
        if max_time == min_time:
            score_time = 1.0
        else:
            score_time = 1.0 - ((s.lead_time_days - min_time) / (max_time - min_time))

        # 3. Carbon Score (Lower carbon footprint is better)
        if max_carbon == min_carbon:
            score_carbon = 1.0
        else:
            score_carbon = 1.0 - ((s.carbon_footprint_co2 - min_carbon) / (max_carbon - min_carbon))

        # 4. Tariff Score (Lower tariff is better)
        if max_tariff == min_tariff:
            score_tariff = 1.0
        else:
            score_tariff = 1.0 - ((s.tariff_exposure_pct - min_tariff) / (max_tariff - min_tariff))

        # 5. Risk Score (Higher reliability and safer country is better)
        geo_risk = country_risk_map.get(s.country, 0.75)
        score_risk = (s.reliability_score * 0.6) + (geo_risk * 0.4)

        # Compute final weighted score
        final_score = (
            (score_cost * w_cost) +
            (score_time * w_time) +
            (score_risk * w_risk) +
            (score_carbon * w_carbon) +
            (score_tariff * w_tariff)
        ) * 100.0

        final_score = round(final_score, 1)

        # Dynamic Pros and Cons generation
        pros = []
        cons = []

        # Cost Pros/Cons
        if s.base_cost_usd <= min_cost * 1.1:
            pros.append("Highly cost-effective procurement pricing")
        elif s.base_cost_usd >= max_cost * 0.9:
            cons.append("Premium unit pricing adds substantial capital expense")

        # Lead Time Pros/Cons
        if s.lead_time_days <= min_time * 1.15:
            pros.append(f"Short procurement lead time ({s.lead_time_days} days)")
        elif s.lead_time_days >= max_time * 0.85:
            cons.append(f"Extended procurement cycle time ({s.lead_time_days} days)")

        # Geopolitical / Tariff Pros/Cons
        if s.tariff_exposure_pct == 0:
            pros.append("Zero tariff exposure under active trade policies")
        elif s.tariff_exposure_pct >= 20.0:
            cons.append(f"Heavy tariff exposure ({s.tariff_exposure_pct}%)")

        if s.country in ["USA", "Mexico"]:
            pros.append(f"Favorable USMCA logistics Corridor ({s.country})")
        elif s.country == "Taiwan":
            cons.append("Elevated geopolitical risk in shipping straits")
        elif s.country == "China":
            cons.append("High risk of regulatory export/import controls")

        # Reliability Pros/Cons
        if s.reliability_score >= 0.95:
            pros.append(f"Industry-leading supplier delivery track record ({int(s.reliability_score*100)}%)")
        elif s.reliability_score < 0.88:
            cons.append(f"Historical shipping reliability challenges ({int(s.reliability_score*100)}%)")

        # Carbon Pros/Cons
        if s.carbon_footprint_co2 <= min_carbon * 1.2:
            pros.append(f"Eco-certified production facility ({s.carbon_footprint_co2}t CO2)")
        elif s.carbon_footprint_co2 >= max_carbon * 0.85:
            cons.append(f"High carbon footprint profile ({s.carbon_footprint_co2}t CO2)")

        results.append({
            "supplier": s,
            "score": final_score,
            "estimated_lead_time_days": s.lead_time_days,
            "estimated_cost_usd": s.base_cost_usd,
            "carbon_footprint_co2": s.carbon_footprint_co2,
            "tariff_exposure_pct": s.tariff_exposure_pct,
            "pros": pros[:3],  # limit to top 3
            "cons": cons[:3],  # limit to top 3
        })

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
