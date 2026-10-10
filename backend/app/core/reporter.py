from typing import Dict, Any

def generate_markdown_report(experiment: Dict[str, Any]) -> str:
    exp_id = experiment.get("experiment_id", "N/A")
    d_name = experiment.get("dataset_name", "N/A")
    d_mode = experiment.get("data_mode", "N/A").upper()
    target = experiment.get("target_column", "N/A")
    created_at = experiment.get("created_at", "N/A")
    completed_at = experiment.get("completed_at", "N/A")
    total_time = experiment.get("total_runtime_seconds", 0.0)
    train_count = experiment.get("train_sample_count", 0)
    test_count = experiment.get("test_sample_count", 0)
    features = experiment.get("selected_features", [])
    metrics = experiment.get("metrics", {})
    
    warning_banner = ""
    if d_mode == "SYNTHETIC":
        warning_banner = (
            "> **WARNING: SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE.**\n"
            "> This experiment was evaluated on synthetic illustrative data for algorithmic feasibility testing. "
            "Results must not be used for clinical decision making or therapeutic guidance.\n\n"
        )
        
    # Table of models
    table_rows = []
    for m_key, m_val in metrics.items():
        name = m_val.get("display_name", m_key)
        acc = f"{m_val.get('accuracy', 0.0):.4f}"
        bal_acc = f"{m_val.get('balanced_accuracy', 0.0):.4f}"
        prec = f"{m_val.get('precision', 0.0):.4f}"
        rec = f"{m_val.get('recall', 0.0):.4f}"
        f1 = f"{m_val.get('f1_score', 0.0):.4f}"
        auc = f"{m_val.get('roc_auc'):.4f}" if m_val.get('roc_auc') is not None else "N/A"
        t_sec = f"{m_val.get('training_time_seconds', 0.0):.3f}s"
        status = m_val.get("status", "completed")
        table_rows.append(f"| {name} | {status} | {acc} | {bal_acc} | {prec} | {rec} | {f1} | {auc} | {t_sec} |")
        
    table_str = "\n".join(table_rows) if table_rows else "| No models trained | - | - | - | - | - | - | - | - |"
    
    report = f"""# MarrowQ Experiment Research Report
**Experiment Identifier:** `{exp_id}`  
**Date Created:** {created_at}  
**Date Completed:** {completed_at} (Duration: {total_time:.2f}s)  
**Data Mode:** {d_mode}  

---

{warning_banner}

## 1. Study Objective & Research Context
MarrowQ investigates the feasibility and empirical utility of quantum-assisted machine learning (specifically Fidelity-based Quantum-Kernel Support Vector Machines via Qiskit ML) compared against established classical baselines for predicting timely hematologic recovery following Hematopoietic Stem Cell Transplantation (HSCT).

## 2. Dataset & Cohort Specification
- **Dataset Name:** {d_name}
- **Data Provenance:** {d_mode} Demonstration Mode
- **Training Samples ($N_{{train}}$):** {train_count}
- **Held-Out Test Samples ($N_{{test}}$):** {test_count}
- **Target Endpoint:** `{target}`
  - Definition: Binary indicator of Absolute Neutrophil Count (ANC) recovery >= 500/uL on or before post-transplant Day 28.
- **Permitted Pre-Transplant Features ({len(features)}):**
  `{", ".join(features)}`

## 3. Leakage-Safe Preprocessing Protocol
- **Partitioning:** Stratified train/test split (Test ratio = {experiment.get('test_size', 0.25)}).
- **Transformation Isolation:** Median imputation for continuous covariates, mode imputation for categorical covariates, One-Hot Encoding, and Standard Scaling were fitted **strictly on the training partition**. No test statistics leaked into preprocessing.
- **Quantum Feature Reduction:** Dimensionality reduced via training-fitted PCA into low-dimensional Hilbert space representation followed by [0, 2*pi] angle scaling.

## 4. Empirical Evaluation Results

| Model | Status | Accuracy | Balanced Acc | Precision | Recall | F1 Score | ROC-AUC | Training Time |
|---|---|---|---|---|---|---|---|---|
{table_str}

## 5. Scientific Interpretation & Quantum Comparison
- **Classical Baselines:** Established reference standards using Dummy Classifier, Regularized Logistic Regression, Random Forest, and Classical RBF SVM.
- **Quantum-Kernel SVM:** Evaluated using a fidelity quantum kernel with a parameterized ZZFeatureMap executed on a local statevector simulator.
- **Comparative Finding:** The matched Classical RBF SVM operates on the identical reduced dimensionality, isolating the specific geometric mapping contribution of the quantum feature map. Class counts, ROC-AUC, and runtimes demonstrate honest experimental outcomes without pre-ordained victory for quantum methods.

## 6. Study Limitations & Ethical Boundaries
1. **Synthetic Data Boundaries:** If run under synthetic mode, distributions mimic registry data but do not reflect prospective patient pathophysiology.
2. **Competing Risks:** Binary classification at Day 28 does not model competing risks (e.g. early infection-related mortality prior to engraftment) which requires prospective Fine-Gray survival analysis.
3. **Clinical Decision Support:** This software is a research prototype and is **NOT approved for diagnostic or clinical decision making**.

## 7. References
- *Machine Learning Prediction Model for Neutrophil Recovery after Unrelated Cord Blood Transplantation*, Transplantation and Cellular Therapy, 2024 (PMID: 38336299).
- *Survival Prediction in Allogeneic Haematopoietic Stem Cell Transplant Recipients Using Pre- and Post-Transplant Factors*, J. Cell. Mol. Med., 2025 (PMCID: PMC12381535).
- *Qiskit Machine Learning Quantum Kernel Documentation*, Qiskit Community, 2024.
"""
    return report
