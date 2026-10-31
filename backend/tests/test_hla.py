import pytest
from app.core.hla import (
    HLATyping, AllelePair, MatchLocus, compute_donor_compatibility,
    classify_dpb1_tce, evaluate_dsa, DPB1_TCE_GROUPS
)

def test_perfect_12_of_12_match():
    rec = HLATyping(
        a=AllelePair("02:01", "01:01"),
        b=AllelePair("07:02", "08:01"),
        c=AllelePair("07:01", "03:04"),
        drb1=AllelePair("15:01", "03:01"),
        dqb1=AllelePair("06:02", "02:01"),
        dpb1=AllelePair("04:01", "02:01")
    )
    don = HLATyping(
        a=AllelePair("02:01", "01:01"),
        b=AllelePair("07:02", "08:01"),
        c=AllelePair("07:01", "03:04"),
        drb1=AllelePair("15:01", "03:01"),
        dqb1=AllelePair("06:02", "02:01"),
        dpb1=AllelePair("04:01", "02:01")
    )
    res = compute_donor_compatibility(rec, don)
    assert res["score_10"] == "10/10"
    assert res["score_12"] == "12/12"
    assert res["compatibility_tier"] == "OPTIMAL_MATCH"
    assert res["dpb1_tce_assessment"]["is_permissive"] is True
    assert res["directional_mismatches"]["graft_versus_host_count"] == 0


def test_dpb1_tce_permissiveness():
    # Recipient has Group 3 (04:01, 02:01)
    # Donor has Group 1 (09:01, 04:01) -> Non-permissive GvH shift
    rec_dpb1 = AllelePair("04:01", "02:01")
    don_dpb1 = AllelePair("09:01", "04:01")
    tce_eval = classify_dpb1_tce(rec_dpb1, don_dpb1)
    assert tce_eval["is_permissive"] is False
    assert tce_eval["status"] == "NON_PERMISSIVE_GVH"
    assert tce_eval["gvh_group_shift"] is True


def test_dsa_high_mfi_contraindication():
    # Recipient has anti-donor antibody against HLA-A*02:01 with high MFI (6500)
    dsa_panel = {"02:01": 6500.0, "03:01": 500.0}
    mismatched_alleles = ["HLA-A*02:01"]
    dsa_res = evaluate_dsa(mismatched_alleles, dsa_panel)
    assert dsa_res["status"] == "POSITIVE"
    assert dsa_res["risk_tier"] == "HIGH_RISK_CONTRAINDICATION"
    assert dsa_res["max_mfi"] == 6500.0

