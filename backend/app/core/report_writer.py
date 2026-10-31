"""Clinical review reports drafted by Claude from computed facts only, with a deterministic fallback.

The model receives the review's computed results as JSON and must not introduce any number that is not in
them; every number in the draft is checked against the facts before it is accepted.
"""
import json
import logging
import re
from typing import Any, Dict, Iterable, Optional, Set

from pydantic import BaseModel

from app.core.settings import get_settings

log = logging.getLogger("marrowq.reports")
MODEL = "claude-opus-5-5"

SYSTEM_PROMPT = """You draft clinical review notes for a haematopoietic stem-cell transplant team.
You receive the complete computed results of one review as JSON. Write two texts:

1. physician_report: a concise note for the transplant haematologist (6-12 short lines, plain text, no markdown
   headings). Cover the latest counts, the engraftment forecast, what the trained models estimate and how much they
   agree, the evidence items, and any data-quality warnings. State the model scope (paediatric UCI cohort) once.
2. patient_summary: 3-6 short sentences for the patient or family, warm and plain-language, no jargon, no
   probabilities beyond what is in the data, ending with when to contact the nurse (temperature of 38 °C or higher,
   chills, or unusual bleeding).

Rules: use only facts present in the JSON. Do not add, round differently, or infer any number, date, drug, dose,
diagnosis or recommendation that is not in the JSON. Never give treatment instructions. If something is missing,
say it has not been recorded."""


class ReportDraft(BaseModel):
    physician_report: str
    patient_summary: str


def _numbers_in(value: Any) -> Iterable[float]:
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)):
        yield float(value)
    elif isinstance(value, str):
        for m in re.findall(r"-?\d[\d,]*\.?\d*", value):
            try:
                yield float(m.replace(",", ""))
            except ValueError:
                continue
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _numbers_in(k)  # e.g. day keys of probability tables
            yield from _numbers_in(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _numbers_in(v)


def _allowed_numbers(facts: Dict[str, Any]) -> Set[float]:
    allowed = {0.0, 1.0, 2.0, 3.0, 38.0, 500.0, 20000.0}  # counting words, the fever threshold and engraftment thresholds
    for n in _numbers_in(facts):
        for v in (n, n * 100):
            allowed.update({round(v, 0), round(v, 1), round(v, 2), round(v, 3)})
    return allowed


def unsupported_numbers(text: str, facts: Dict[str, Any]) -> Set[float]:
    allowed = _allowed_numbers(facts)
    return {n for n in _numbers_in(text) if all(abs(n - a) > 1e-6 for a in allowed)}


def deterministic_report(facts: Dict[str, Any]) -> Dict[str, str]:
    labs, fc = facts["latest_counts"], facts.get("engraftment_forecast") or {}
    lines = [f"Day +{facts['days_post_transplant']} · {facts['disease']} · latest ANC {labs['anc']:,.0f}/µL, platelets {labs['platelets']:,.0f}/µL."]
    if fc.get("median_engraftment_day") is not None:
        lines.append(f"Neutrophil forecast: median Day +{fc['median_engraftment_day']:g}; P(by Day +14/21/28) "
                     + " / ".join(f"{fc['probability_engrafted_by'][str(d)]:.0%}" for d in (14, 21, 28)) + ".")
    for m in facts.get("models", []):
        lines.append(f"{m['display_name']}: {m['probability']:.0%} for {facts['model_target']} (CV ROC-AUC {m['roc_auc_cv']:.2f}).")
    if facts.get("agreement"):
        lines.append(f"Model agreement: {facts['agreement']['status']}.")
    for w in facts.get("warnings", []):
        lines.append(f"Warning: {w}")
    lines.append("Draft for hematologist review. No treatment recommendation is generated.")
    anc_line = ("Your infection-fighting white cells (neutrophils) have reached the 500 mark doctors look for"
                if labs["anc"] >= 500 else f"Your infection-fighting white cells (neutrophils) are at {labs['anc']:,.0f}; doctors are waiting for them to reach 500")
    patient = (f"Today is Day +{facts['days_post_transplant']} after your transplant. {anc_line}. "
               f"Your platelets, which help your blood clot, are at {labs['platelets']:,.0f}. "
               "Your transplant team reviews every result. Tell your nurse straight away about a temperature of 38 °C or higher, chills, or unusual bleeding.")
    return {"physician_report": "\n".join(lines), "patient_summary": patient}


def draft_reports(facts: Dict[str, Any]) -> Dict[str, Any]:
    """Returns {physician_report, patient_summary, author, note}."""
    key: Optional[str] = get_settings().anthropic_api_key
    if not key:
        return {**deterministic_report(facts), "author": "template", "note": "ANTHROPIC_API_KEY not configured"}
    import anthropic

    client = anthropic.Anthropic(api_key=key, max_retries=2, timeout=90)
    payload = json.dumps(facts, ensure_ascii=False, indent=1)
    note = ""
    for attempt in range(2):
        try:
            response = client.messages.parse(
                model=MODEL,
                max_tokens=4000,
                system=SYSTEM_PROMPT,
                output_config={"effort": "low"},
                messages=[{"role": "user", "content": f"Review results:\n{payload}"}],
                output_format=ReportDraft,
            )
        except anthropic.APIStatusError as exc:
            note = f"Claude API error {exc.status_code}: {getattr(exc, 'message', str(exc))[:160]}"
            log.warning("report draft failed: %s", exc)
            break
        except anthropic.APIConnectionError as exc:
            note = "Claude API unreachable"
            log.warning("report draft failed: %s", exc)
            break
        if response.stop_reason == "refusal" or response.parsed_output is None:
            note = "Claude declined or returned no draft"
            break
        draft = response.parsed_output
        bad = unsupported_numbers(draft.physician_report + " " + draft.patient_summary, facts)
        if not bad:
            return {"physician_report": draft.physician_report, "patient_summary": draft.patient_summary,
                    "author": MODEL, "note": "Every number checked against the computed results"}
        note = f"Draft rejected: numbers not in the computed results ({', '.join(f'{b:g}' for b in sorted(bad)[:5])})"
        log.warning(note)
    return {**deterministic_report(facts), "author": "template", "note": note}
