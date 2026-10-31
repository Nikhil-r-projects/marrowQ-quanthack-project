"""Markdown research report. Every statement is derived from the stored experiment record."""
from typing import Any, Dict

from app.core.datasets import uci_bmt

TARGET_DEFINITIONS = {
    "early_engraftment": f"Neutrophil engraftment (ANC > 0.5×10⁹/L) by Day +{uci_bmt.EARLY_ENGRAFTMENT_DAY}.",
    "neutrophil_recovery_day28": "Neutrophil recovery (ANC ≥ 500/µL) by Day +28.",
}


def _fmt_ci(ci) -> str:
    return f" ({ci[0]:.2f}–{ci[1]:.2f})" if ci else ""


def generate_markdown_report(experiment: Dict[str, Any]) -> str:
    metrics: Dict[str, Dict[str, Any]] = experiment.get("metrics") or {}
    target = experiment.get("target_column", "")
    features = experiment.get("selected_features", [])
    evaluation = (experiment.get("config") or {}).get("evaluation") or {}
    synthetic = experiment.get("data_mode") == "synthetic"

    rows = []
    for m in metrics.values():
        auc = f"{m['roc_auc']:.3f}{_fmt_ci(m.get('roc_auc_ci'))}" if m.get("roc_auc") is not None else "n/a"
        brier = f"{m['brier_score']:.3f}" if m.get("brier_score") is not None else "n/a"
        scope = "out-of-fold, all patients" if m.get("evaluation") else "single held-out split"
        rows.append(f"| {m['display_name']} | {auc} | {m['balanced_accuracy']:.3f} | {brier} | {m['test_sample_count']} | {scope} |")

    scored = {k: m for k, m in metrics.items() if m.get("roc_auc") is not None and k != "dummy"}
    findings = []
    if scored:
        best_key = max(scored, key=lambda k: scored[k]["roc_auc"])
        best = scored[best_key]
        findings.append(f"- Highest discrimination: **{best['display_name']}**, ROC-AUC {best['roc_auc']:.3f}{_fmt_ci(best.get('roc_auc_ci'))}.")
        overlapping = [m["display_name"] for k, m in scored.items() if k != best_key and m.get("roc_auc_ci") and best.get("roc_auc_ci") and m["roc_auc_ci"][1] >= best["roc_auc"]]
        if overlapping:
            findings.append(f"- Confidence intervals overlap with: {', '.join(overlapping)}; differences between these models are not statistically distinguishable at this sample size.")
        if "dummy" in metrics:
            findings.append(f"- Majority-class baseline ROC-AUC: {metrics['dummy']['roc_auc']:.3f} (reference for no skill).")
        q = metrics.get("quantum_kernel_svm")
        if q and q.get("roc_auc") is not None:
            verdict = "no better than chance" if q["roc_auc"] <= 0.55 else "below the best classical model" if q["roc_auc"] < best["roc_auc"] else "at or above the best classical model"
            n_q = q.get("extra_info", {}).get("n_qubits") if q.get("extra_info") else None
            findings.append(f"- Quantum-kernel SVM{f' ({n_q} qubits)' if n_q else ''}: ROC-AUC {q['roc_auc']:.3f} on {q['test_sample_count']} held-out patients, {verdict}.")

    banner = "> **Synthetic data:** results describe a simulated cohort and are not clinical evidence.\n\n" if synthetic else ""
    method = evaluation.get("method", "Single stratified train/test split.")
    return f"""# MarrowQ experiment report
**Experiment:** `{experiment.get('experiment_id', 'n/a')}` · **Dataset:** {experiment.get('dataset_name', 'n/a')} · **Completed:** {experiment.get('completed_at', 'n/a')} · **Runtime:** {experiment.get('total_runtime_seconds') or 0:.1f} s

{banner}## Question
Can pre-transplant information predict: {TARGET_DEFINITIONS.get(target, f'`{target}`')}

## Data
- Patients analysed: {evaluation.get('n_samples', experiment.get('train_sample_count', 0) + experiment.get('test_sample_count', 0))}; class counts {evaluation.get('class_counts', experiment.get('class_distribution_train', {}))}.
- Predictors ({len(features)}): {', '.join(f'`{f}`' for f in features)}.

## Method
- Classical models: {method}
- Quantum-kernel SVM: features compressed by training-fold PCA to one per qubit, ZZ feature map, fidelity kernel; evaluated on a single held-out split (test fraction {experiment.get('test_size', 0.25)}).
- All preprocessing (imputation, log transform of skewed doses, scaling, encoding) is fitted on training data only.

## Results
| Model | ROC-AUC (95% CI) | Balanced accuracy | Brier | N evaluated | Scope |
|---|---|---|---|---|---|
{chr(10).join(rows) if rows else '| No models trained | | | | | |'}

## Findings
{chr(10).join(findings) if findings else '- No scored models.'}

## Limitations
- {'Single-centre paediatric cohort (UCI, n = 187); performance may not transfer to adults or other centres.' if experiment.get('dataset_id') == uci_bmt.DATASET_ID else 'External validity depends on how representative the uploaded cohort is.'}
- Associations are not causal effects. Research prototype; not for clinical decision-making.

## Data source
{uci_bmt.CITATION if experiment.get('dataset_id') == uci_bmt.DATASET_ID else experiment.get('dataset_name', '')}
"""
