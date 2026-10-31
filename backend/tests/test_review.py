import types

from fastapi.testclient import TestClient

from app.core import report_writer
from app.main import app

client = TestClient(app)

FACTS = {"days_post_transplant": 12, "disease": "ALL", "latest_counts": {"anc": 340.0, "platelets": 14000.0},
         "engraftment_forecast": {"median_engraftment_day": 15.0, "probability_engrafted_by": {"14": 0.31, "21": 0.98, "28": 1.0}},
         "model_target": "neutrophil engraftment by Day +14",
         "models": [{"display_name": "Logistic regression (L2)", "probability": 0.448, "roc_auc_cv": 0.755}],
         "agreement": {"status": "Models agree"}, "warnings": []}


def test_number_check_rejects_invented_values():
    assert report_writer.unsupported_numbers("ANC 340 on Day +12, 45% chance (0.448), 31% by Day +14", FACTS) == set()
    assert report_writer.unsupported_numbers("ANC 420 and engraftment in 48 hours", FACTS) == {420.0, 48.0}


def test_template_used_without_key_and_contains_only_facts():
    out = report_writer.draft_reports(FACTS)
    assert out["author"] == "template"
    assert report_writer.unsupported_numbers(out["physician_report"] + " " + out["patient_summary"], FACTS) == set()


def test_claude_draft_accepted_only_when_numbers_check(monkeypatch):
    drafts = [
        report_writer.ReportDraft(physician_report="ANC 999 on Day +12.", patient_summary="Counts are rising."),
        report_writer.ReportDraft(physician_report="Day +12: ANC 340/µL, platelets 14,000/µL. Forecast median Day +15.",
                                  patient_summary="Your counts are recovering. Call your nurse for a temperature of 38 °C or more."),
    ]
    calls = []

    class FakeMessages:
        def parse(self, **kwargs):
            calls.append(kwargs)
            return types.SimpleNamespace(stop_reason="end_turn", parsed_output=drafts[len(calls) - 1])

    import anthropic
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: types.SimpleNamespace(messages=FakeMessages()))
    monkeypatch.setattr(report_writer, "get_settings", lambda: types.SimpleNamespace(anthropic_api_key="test"))
    out = report_writer.draft_reports(FACTS)
    assert out["author"] == report_writer.MODEL and "340" in out["physician_report"]
    assert len(calls) == 2 and calls[0]["model"] == "claude-opus-5-5"


def test_sign_off_flow_and_patient_summary():
    patient = client.post("/api/patients/examples", json={"count": 1, "seed": 21}).json()[0]
    pid = patient["patient_id"]
    for metric, value, unit in (("Absolute Neutrophil Count (ANC)", 300.0, "cells/µL"), ("Platelets", 25000.0, "/µL")):
        client.post(f"/api/patients/{pid}/observations", json={"patient_id": pid, "day_post_tx": 9, "recorded_date": "2026-10-31", "metric_type": metric, "value": value, "unit": unit})
    review = client.post("/api/agents/orchestrate", json={"patient_id": pid}).json()
    assert client.get(f"/api/patients/{pid}/approved-summary").json() == {"available": False}
    assert client.post(f"/api/predictions/{review['prediction_id']}/review", json={"decision": "approve", "reviewer": "Dr Test"}).status_code == 200
    assert client.post(f"/api/predictions/{review['prediction_id']}/review", json={"decision": "reject", "reviewer": "Dr Test"}).status_code == 409
    summary = client.get(f"/api/patients/{pid}/approved-summary").json()
    assert summary["available"] and summary["reviewed_by"] == "Dr Test" and summary["patient_summary"]
