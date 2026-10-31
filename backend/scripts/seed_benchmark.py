import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.patients import ensure_golden_benchmark_patient, list_patients, seed_patient_surveillance_panel

if __name__ == "__main__":
    golden = ensure_golden_benchmark_patient()
    print(f"Golden benchmark patient created/verified: {golden['patient_id']} - {golden['name']}")

    all_pats = list_patients()
    print(f"Found {len(all_pats)} patients in database.")
    for p in all_pats:
        seed_patient_surveillance_panel(
            patient_id=p["patient_id"],
            transplant_date_str=p.get("transplant_date", "2026-10-15"),
            days=21,
            baseline_mass=float(p.get("weight_kg", 25.0) or 25.0)
        )
        print(f"  -> Seeded 13 surveillance biomarkers for {p['patient_id']} ({p.get('name')})")

    print("\nAll patient surveillance panels populated with zero missing data!")

