"""Automated Test Suite for Expanded Disease Modules, Treatment Intelligence & Non-HLA Matching.
"""
import pytest
from app.core.disease_modules import (
    evaluate_all, evaluate_cml, evaluate_cll, evaluate_myelofibrosis_dipss,
    evaluate_multiple_myeloma_riss, evaluate_icans_neurotoxicity
)
from app.core.treatment_intelligence import TreatmentComparisonEngine
from app.core.pgx import adjust_medication_for_organ_clearance
from app.core.hla import evaluate_non_hla_donor_factors, evaluate_solid_organ_crossmatch


def test_evaluate_all():
    res = evaluate_all(blast_pct=35.0, immunophenotype="B-ALL", cytogenetics="46,XX,t(9;22)(q34;q11.2)")
    assert res["is_ph_positive"] is True
    assert res["risk_tier"] == "HIGH_RISK_PH_POSITIVE"
    assert any("Dasatinib" in t for t in res["targeted_therapies"])


def test_evaluate_cml():
    res = evaluate_cml(spleen_cm_below_costal_margin=6.0, platelets_thous=650.0, blast_pct_peripheral=3.0, age=48.0, bcr_abl1_is_pct=0.008)
    assert res["sokal_score"] > 0.0
    assert "DEEP_MOLECULAR_RESPONSE" in res["molecular_milestone_status"]


def test_evaluate_cll():
    res = evaluate_cll(tp53_disrupted=True, ighv_unmutated=True, beta2_microglobulin_mg_l=4.2, clinical_stage_advanced=True, age=68.0)
    assert res["cll_ipi_score"] == 10  # 4 + 2 + 2 + 1 + 1
    assert "VERY_HIGH_RISK" in res["cll_ipi_risk_group"]


def test_evaluate_myelofibrosis():
    res = evaluate_myelofibrosis_dipss(age=68.0, wbc_thous=28.0, hb_g_dl=9.2, circulating_blasts_pct=2.0, constitutional_symptoms=True)
    assert res["dipss_score"] == 6  # 1 + 1 + 2 + 1 + 1
    assert "HIGH_RISK" in res["dipss_risk_tier"]
    assert res["transplant_indication"] is True


def test_evaluate_multiple_myeloma():
    res = evaluate_multiple_myeloma_riss(serum_beta2_microglobulin_mg_l=6.0, serum_albumin_g_dl=2.8, high_risk_fish=True, elevated_ldh=True)
    assert res["stage_tier"] == "STAGE_III"


def test_evaluate_icans():
    res = evaluate_icans_neurotoxicity(ice_score=2, motor_weakness=True)
    assert "GRADE_3" in res["icans_grade"]


def test_treatment_comparison_engine():
    engine = TreatmentComparisonEngine()
    hct = engine.calculate_hct_ci(["cad", "diabetes", "moderate_severe_renal_impairment"])
    assert hct["hct_ci_score"] == 4  # 1 + 1 + 2
    assert hct["comorbidity_risk_tier"] == "HIGH_RISK"

    opts = engine.evaluate_treatment_options(
        disease="AML",
        risk_category="ADVERSE",
        patient_age=58.0,
        lvef_pct=38.0,  # Below 40% -> Contraindication
        comorbidities=["cad", "diabetes"]
    )
    assert len(opts["organ_contraindications"]) > 0
    assert any("Cardiac" in c for c in opts["organ_contraindications"])


def test_pgx_organ_clearance_adjustment():
    adj = adjust_medication_for_organ_clearance(
        medication_name="Fludarabine",
        standard_dose_mg=50.0,
        egfr_ml_min=25.0
    )
    assert adj["dose_modified"] is True
    assert adj["recommended_dose_mg"] == 25.0  # 50% reduction for eGFR < 30


def test_non_hla_donor_and_solid_organ():
    non_hla = evaluate_non_hla_donor_factors(
        donor_age=23.0,
        recipient_cmv="POSITIVE",
        donor_cmv="NEGATIVE",
        recipient_abo="O",
        donor_abo="A"
    )
    assert "OPTIMAL" in non_hla["donor_age_assessment"]["tier"]
    assert "HIGH_RISK_REACTIVATION" in non_hla["cmv_concordance"]["risk_tier"]
    assert "MAJOR_ABO_INCOMPATIBILITY" in non_hla["abo_compatibility"]["incompatibility_type"]

    solid = evaluate_solid_organ_crossmatch(
        recipient_pra_pct=45.0,
        donor_specific_antibodies=[{"locus": "HLA-A*02:01", "mfi": 6200}],
        recipient_blood_group="A",
        donor_blood_group="A"
    )
    assert "POSITIVE" in solid["virtual_crossmatch_status"]
