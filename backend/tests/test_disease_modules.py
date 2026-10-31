import pytest
from app.core.disease_modules import (
    evaluate_aml, evaluate_mds_ipss_m, evaluate_aplastic_anemia,
    evaluate_kidney_function, evaluate_liver_function, evaluate_cardiovascular_risk
)

def test_aml_eln_2022_favorable():
    # NPM1 mutated without FLT3-ITD -> Favorable
    res = evaluate_aml(blast_pct=35.0, mutations=["NPM1"], cytogenetics="Normal", age=45.0)
    assert res["diagnostic_status"] == "CONFIRMED_AML"
    assert res["eln_2022_risk_category"] == "FAVORABLE"


def test_aml_eln_2022_adverse():
    # TP53 mutation -> Adverse
    res = evaluate_aml(blast_pct=42.0, mutations=["TP53", "NPM1"], cytogenetics="Complex", age=62.0)
    assert res["eln_2022_risk_category"] == "ADVERSE"


def test_mds_ipss_m_scoring():
    # High blast count + TP53 mutation -> Very High Risk
    res = evaluate_mds_ipss_m(
        bm_blast_pct=12.0, hb=7.5, platelets=25000.0, anc=400.0,
        cytogenetics_category="Poor", mutations=["TP53", "ASXL1"]
    )
    assert res["ipss_m_risk_category"] == "VERY_HIGH"
    assert "TP53" in res["molecular_drivers_detected"]


def test_saa_camitta_criteria():
    # Cellularity 10%, ANC 120, Plt 12,000 -> Very Severe Aplastic Anemia
    res = evaluate_aplastic_anemia(
        bm_cellularity_pct=10.0, anc=120.0, platelets=12000.0, reticulocytes=10000.0
    )
    assert res["is_very_severe"] is True
    assert "VERY_SEVERE" in res["camitta_classification"]


def test_kidney_ckd_epi_and_aki():
    res = evaluate_kidney_function(serum_creatinine=2.4, age=65.0, sex="Male", baseline_creatinine=1.1)
    assert res["estimated_gfr_ml_min"] < 40.0
    assert res["dose_adjustment_required"] is True
    assert res["aki_status"] == "KDIGO_AKI_STAGE_2" # 2.4 / 1.1 >= 2.0


def test_liver_meld_na_and_fib4():
    res = evaluate_liver_function(
        total_bilirubin=3.5, serum_creatinine=1.8, inr=1.9, serum_sodium=132.0,
        ast=85.0, alt=65.0, platelets=45000.0, age=55.0
    )
    assert res["meld_na_score"] >= 20
    assert res["fib_4_index"] > 2.67
    assert "HIGH_FIBROSIS_RISK" in res["fibrosis_risk_interpretation"]

