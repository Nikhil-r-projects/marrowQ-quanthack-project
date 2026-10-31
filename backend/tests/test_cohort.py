import pytest
from fastapi.testclient import TestClient

from app.core.database import get_connection, get_patient, purge_legacy_seed_data
from app.core.datasets import uci_bmt
from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def cohort():
    return uci_bmt.load_cohort()


def test_decoded_cohort_matches_source(cohort):
    assert len(cohort) == 187
    assert cohort.patient_id.is_unique and cohort.patient_id.iloc[0] == "UCI-001"
    assert set(uci_bmt.PRE_TRANSPLANT_FEATURES).isdisjoint(uci_bmt.OUTCOMES)
    s = uci_bmt.summary(cohort)
    assert s["anc_recovery_median_day"] == 15.0
    assert s["anc_never_recovered"] == 5
    assert s["early_engraftment_rate"] == pytest.approx(0.417, abs=0.001)


def test_hla_difference_counts_add_up_to_mismatched_loci(cohort):
    mismatched_loci = cohort.hla_match.map({"10/10": 0, "9/10": 1, "8/10": 2, "7/10": 3})
    total = cohort.hla_antigen_differences + cohort.hla_allele_differences
    known = total.notna()
    assert (total[known] == mismatched_loci[known]).all()


def test_ratio_and_abo_columns_mean_what_they_are_named(cohort):
    r = cohort.dropna(subset=["cd3_dose", "cd34_cd3_ratio"])
    # Source rounding of the doses allows a few percent of drift.
    assert ((r.cd34_cd3_ratio - r.cd34_dose / r.cd3_dose).abs() / r.cd34_cd3_ratio).max() < 0.08
    a = cohort.dropna(subset=["recipient_abo", "abo_mismatched"])
    assert ((a.donor_abo != a.recipient_abo).astype(int) == a.abo_mismatched).mean() > 0.99
    assert ((cohort.disease != "Non-malignant").astype(int) == cohort.malignant).all()


def test_inverted_gvhd_coding_is_decoded(cohort):
    assert cohort.agvhd_iii_iv.sum() == 40
    assert (cohort.agvhd_iii_iv.astype(bool) == cohort.agvhd_iii_iv_day.notna()).all()
    notes = uci_bmt.quality_notes(uci_bmt.fetch_raw(), cohort)
    assert any("UCI-106" in n and "UCI-123" in n for n in notes)


def test_cohort_api_exposes_dictionary_with_observed_ranges():
    data = client.get("/api/cohort").json()
    assert data["license"] == "CC BY 4.0"
    cd34 = next(v for v in data["dictionary"] if v["name"] == "cd34_dose")
    assert cd34["observed_min"] == pytest.approx(0.79) and cd34["observed_max"] == pytest.approx(57.78)
    records = client.get("/api/cohort/records").json()
    assert len(records) == 187 and records[0]["patient_id"] == "UCI-001"


def test_demo_dataset_is_the_real_cohort_with_dictionary_roles():
    profile = client.get("/api/datasets/demo").json()
    assert profile["dataset_id"] == uci_bmt.DATASET_ID and profile["data_mode"] == "research"
    assert profile["suggested_target"] == "early_engraftment"
    assert set(profile["suggested_features"]) == set(uci_bmt.CORE_FEATURES) <= set(uci_bmt.PRE_TRANSPLANT_FEATURES)
    assert any(w.startswith("anc_recovery_day") for w in profile["potential_leakage_warnings"])


VALID_INTAKE = {
    "recipient_age": 8.5, "recipient_sex": "Female", "disease": "ALL", "donor_age": 31,
    "hla_match": "10/10", "stem_cell_source": "Peripheral blood", "cd34_dose": 9.2, "donor_cmv": "Positive",
}


def test_intake_admits_valid_patient():
    res = client.post("/api/patients", json={"label": "MRN 001234", "transplant_date": "2026-10-20", "pretransplant": VALID_INTAKE})
    assert res.status_code == 201
    body = res.json()
    assert body["warnings"] == []
    stored = get_patient(body["patient"]["patient_id"])
    assert stored["source"] == "clinical" and stored["pretransplant"]["cd34_dose"] == 9.2
    assert stored["cmv_status"] == "D+/R?"


def test_intake_rejects_bad_values_and_warns_outside_training_range():
    bad = {**VALID_INTAKE, "hla_match": "6/10"}
    bad.pop("cd34_dose")
    res = client.post("/api/patients", json={"label": "x", "transplant_date": "2026-10-20", "pretransplant": bad})
    assert res.status_code == 422
    errors = res.json()["detail"]["errors"]
    assert any("HLA match must be one of" in e for e in errors)
    assert any("CD34+ dose is required" in e for e in errors)

    adult = {**VALID_INTAKE, "recipient_age": 45}
    res = client.post("/api/patients", json={"label": "adult", "transplant_date": "2026-10-20", "pretransplant": adult})
    assert res.status_code == 201
    assert any("outside the training cohort" in w for w in res.json()["warnings"])


def test_example_patients_use_distinct_records_and_can_be_removed():
    created = client.post("/api/patients/examples", json={"count": 4, "seed": 11}).json()
    records = [p["source_record"] for p in created]
    assert len(set(records)) == 4
    again = client.post("/api/patients/examples", json={"count": 4, "seed": 11}).json()
    assert not set(records) & {p["source_record"] for p in again}
    assert client.delete(f"/api/patients/{created[0]['patient_id']}").status_code == 200
    assert client.get(f"/api/patients/{created[0]['patient_id']}").status_code == 404


def test_legacy_invented_seed_rows_are_purged():
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO patients (patient_id, name, age, gender, disease, transplant_type, donor_type, transplant_date, conditioning, status, created_at) "
            "VALUES ('PT-9042-BMT', 'Eleanora Vance', 42, 'F', 'AML', 'Allogeneic HSCT', 'MUD', '2026-10-14', 'MAC', 'Active', '2026-10-14')"
        )
    purge_legacy_seed_data()
    assert get_patient("PT-9042-BMT") is None


def test_intake_derives_dependent_fields_consistently():
    body = {**VALID_INTAKE, "hla_match": "8/10", "hla_antigen_differences": 1, "donor_abo": "O", "recipient_abo": "A", "cd3_dose": 4.0}
    res = client.post("/api/patients", json={"label": "derived", "transplant_date": "2026-10-20", "pretransplant": body})
    assert res.status_code == 201
    p = res.json()["patient"]["pretransplant"]
    assert p["malignant"] == 1 and p["abo_mismatched"] == 1
    assert p["hla_allele_differences"] == 1
    assert p["cd34_cd3_ratio"] == pytest.approx(9.2 / 4.0)

    too_many = {**VALID_INTAKE, "hla_match": "9/10", "hla_antigen_differences": 3}
    res = client.post("/api/patients", json={"label": "bad", "transplant_date": "2026-10-20", "pretransplant": too_many})
    assert res.status_code == 422


def test_clinical_review_refuses_to_invent_missing_counts():
    patient = client.post("/api/patients/examples", json={"count": 1, "seed": 3}).json()[0]
    res = client.post("/api/agents/orchestrate", json={"patient_id": patient["patient_id"]})
    assert res.status_code == 400 and "Record at least one" in res.json()["detail"]
    for metric, value, unit in (("Absolute Neutrophil Count (ANC)", 260.0, "cells/μL"), ("Platelets", 31000.0, "/μL")):
        client.post(f"/api/patients/{patient['patient_id']}/observations", json={
            "patient_id": patient["patient_id"], "day_post_tx": 9, "recorded_date": "2026-10-31",
            "metric_type": metric, "value": value, "unit": unit})
    report = client.post("/api/agents/orchestrate", json={"patient_id": patient["patient_id"]}).json()["reports"]
    assert "260" in report["patient_friendly_summary"] and "31,000" in report["patient_friendly_summary"]
    assert "420" not in report["patient_friendly_summary"]


def test_cross_validated_benchmark_reports_out_of_fold_metrics_with_cis(cohort):
    from app.core.benchmark import run_cross_validated_benchmark
    metrics, finals, summary = run_cross_validated_benchmark(
        cohort, "early_engraftment", uci_bmt.CORE_FEATURES, ["dummy", "logistic_regression", "random_forest"], n_repeats=1)
    lr = metrics["logistic_regression"]
    assert lr["test_sample_count"] == 187 and lr["roc_auc"] > 0.6
    lo, hi = lr["roc_auc_ci"]
    assert lo < lr["roc_auc"] < hi
    assert metrics["dummy"]["roc_auc"] < 0.6
    assert "ensemble" in metrics and set(finals) >= {"logistic_regression", "ensemble"}
    assert finals["ensemble"].predict_proba(cohort[uci_bmt.CORE_FEATURES].head(3)).shape == (3, 2)


def test_engraftment_curve_is_monotone_and_responds_to_graft():
    base = {**VALID_INTAKE}
    good = client.post("/api/engraftment-curve", json={**base, "cd34_dose": 20, "stem_cell_source": "Peripheral blood"}).json()
    poor = client.post("/api/engraftment-curve", json={**base, "cd34_dose": 2, "stem_cell_source": "Bone marrow"}).json()
    curve = good["probability_engrafted"]
    assert all(b >= a for a, b in zip(curve, curve[1:])) and curve[0] < 0.01
    assert good["median_day"] < poor["median_day"]
    assert good["model"]["c_index_cv"] > 0.6
