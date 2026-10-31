import pytest
from app.core.trajectory import evaluate_consensus_engraftment

def test_neutrophil_engraftment_requires_3_consecutive_days():
    # Only 1 day >= 500
    anc_1 = {12: 120.0, 13: 310.0, 14: 550.0, 15: 410.0}
    plt_1 = {14: 15000.0}
    anc_day, plt_day, meta = evaluate_consensus_engraftment(anc_1, plt_1, [])
    assert anc_day is None
    assert meta["anc_confirmed_streak"] == []

    # Only 2 consecutive days >= 500
    anc_2 = {12: 120.0, 13: 310.0, 14: 550.0, 15: 610.0, 16: 480.0}
    anc_day, plt_day, meta = evaluate_consensus_engraftment(anc_2, plt_1, [])
    assert anc_day is None
    assert meta["anc_confirmed_streak"] == []

    # 3 consecutive days >= 500 (Days 14, 15, 16)
    anc_3 = {12: 120.0, 13: 310.0, 14: 550.0, 15: 610.0, 16: 780.0}
    anc_day, plt_day, meta = evaluate_consensus_engraftment(anc_3, plt_1, [])
    # Milestone day must be the FIRST of the 3 days (Day 14)
    assert anc_day == 14
    assert meta["anc_confirmed_streak"] == [14, 15, 16]


def test_platelet_engraftment_transfusion_independence():
    # 3 consecutive counts >= 20,000 (Days 18, 19, 20), but platelet transfusion given on Day 16 (< 7 days)
    anc = {14: 550.0, 15: 610.0, 16: 780.0}
    plt = {17: 18000.0, 18: 25000.0, 19: 31000.0, 20: 38000.0}
    transfusions_recent = [16] # Transfusion on Day 16
    
    _, plt_day_recent, meta_recent = evaluate_consensus_engraftment(anc, plt, transfusions_recent)
    # Must NOT be engrafted due to transfusion support within 7 days
    assert plt_day_recent is None

    # Now with transfusion on Day 8 (> 7 days before Day 18)
    transfusions_remote = [8]
    _, plt_day_remote, meta_remote = evaluate_consensus_engraftment(anc, plt, transfusions_remote)
    # Transfusion independence satisfied -> First day is Day 18
    assert plt_day_remote == 18
    assert meta_remote["plt_confirmed_streak"] == [18, 19, 20]
