import pytest
from app.core.pgx import evaluate_patient_pharmacogenomics, CPIC_RULES

def test_tpmt_poor_metabolizer_alert():
    # TPMT PM -> Thiopurine dose reduction alert
    genotype = {"TPMT": "PM"}
    res = evaluate_patient_pharmacogenomics(genotype)
    assert res["high_risk_contraindications_count"] >= 1
    tpmt_alert = next(a for a in res["alerts"] if a["gene"] == "TPMT")
    assert "90%" in tpmt_alert["actionable_recommendation"]


def test_cyp2c19_voriconazole_poor_metabolizer():
    genotype = {"CYP2C19": "PM"}
    res = evaluate_patient_pharmacogenomics(genotype, intended_medications=["Voriconazole"])
    assert len(res["alerts"]) == 1
    vori_alert = res["alerts"][0]
    assert vori_alert["drug"] == "Voriconazole"
    assert "alternative antifungal" in vori_alert["actionable_recommendation"].lower()


def test_abacavir_hypersensitivity_contraindication():
    genotype = {"HLA-B": "POSITIVE"}
    res = evaluate_patient_pharmacogenomics(genotype, intended_medications=["Abacavir"])
    assert len(res["alerts"]) == 1
    assert "CONTRAINDICATED" in res["alerts"][0]["actionable_recommendation"]

