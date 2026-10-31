"""UCI "Bone marrow transplant: children" (id 565): 187 paediatric allogeneic HSCT recipients.

Sikora M, Wróbel Ł, Gudyś A. UCI Machine Learning Repository, 2020. https://doi.org/10.24432/C5NP6Z
Licence: CC BY 4.0.

The raw file mixes codings (some yes/no columns are inverted, ABO uses -1..2, absent events are
stored as 1,000,000 days). `load_cohort()` decodes everything into readable, typed columns and
keeps pre-transplant features strictly apart from outcomes so models never see post-infusion data.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from app.core.settings import get_settings

UCI_ID = 565
CITATION = "Sikora M, Wróbel Ł, Gudyś A. Bone marrow transplant: children. UCI Machine Learning Repository, 2020. doi:10.24432/C5NP6Z"
LICENSE = "CC BY 4.0"
SOURCE_URL = "https://archive.ics.uci.edu/dataset/565/bone+marrow+transplant+children"
DATASET_ID = "uci_bmt_children"

# The source stores "event never happened" as this many days.
_NEVER = 1_000_000
# Early neutrophil engraftment: ANC > 0.5×10⁹/L by Day +14. Splits the cohort ~42/58, unlike the
# conventional Day +28 cut-off, which 97% of these children meet and therefore cannot discriminate.
EARLY_ENGRAFTMENT_DAY = 14


@dataclass(frozen=True)
class Variable:
    label: str
    description: str
    kind: str  # "numeric" | "categorical" | "binary"
    phase: str  # "pre_transplant" | "outcome" | "id"
    unit: Optional[str] = None
    categories: Optional[List[str]] = None


DATA_DICTIONARY: Dict[str, Variable] = {
    "patient_id": Variable("Record", "De-identified cohort record number", "categorical", "id"),
    # --- Recipient
    "recipient_age": Variable("Recipient age", "Age at transplantation", "numeric", "pre_transplant", "years"),
    "recipient_sex": Variable("Recipient sex", "Sex of the recipient", "categorical", "pre_transplant", categories=["Female", "Male"]),
    "recipient_body_mass": Variable("Body mass", "Recipient body mass at transplantation", "numeric", "pre_transplant", "kg"),
    "recipient_abo": Variable("Recipient ABO", "Recipient ABO blood group", "categorical", "pre_transplant", categories=["O", "A", "B", "AB"]),
    "recipient_rh": Variable("Recipient Rh", "Recipient Rh factor", "categorical", "pre_transplant", categories=["Negative", "Positive"]),
    "recipient_cmv": Variable("Recipient CMV", "Recipient cytomegalovirus serostatus", "categorical", "pre_transplant", categories=["Negative", "Positive"]),
    # --- Disease
    "disease": Variable("Disease", "Indication for transplantation", "categorical", "pre_transplant", categories=["ALL", "AML", "Chronic leukaemia", "Lymphoma", "Non-malignant"]),
    "malignant": Variable("Malignant disease", "Malignant (1) or non-malignant (0) indication", "binary", "pre_transplant"),
    "high_risk": Variable("High-risk disease", "Disease risk group high (1) or low (0)", "binary", "pre_transplant"),
    "second_transplant": Variable("Second transplant", "Transplant after relapse of a previous one", "binary", "pre_transplant"),
    # --- Donor and compatibility
    "donor_age": Variable("Donor age", "Donor age at stem-cell collection", "numeric", "pre_transplant", "years"),
    "donor_abo": Variable("Donor ABO", "Donor ABO blood group", "categorical", "pre_transplant", categories=["O", "A", "B", "AB"]),
    "donor_cmv": Variable("Donor CMV", "Donor cytomegalovirus serostatus", "categorical", "pre_transplant", categories=["Negative", "Positive"]),
    "abo_mismatched": Variable("ABO mismatched", "Donor and recipient ABO blood groups differ", "binary", "pre_transplant"),
    "female_to_male": Variable("Female donor to male recipient", "Sex-mismatched graft from a female donor to a male recipient", "binary", "pre_transplant"),
    "hla_match": Variable("HLA match", "HLA match at 10 loci (BFM SCT 2008)", "categorical", "pre_transplant", categories=["10/10", "9/10", "8/10", "7/10"]),
    "hla_antigen_differences": Variable("HLA antigen differences", "Number of mismatched HLA antigens", "numeric", "pre_transplant", None),
    "hla_allele_differences": Variable("HLA allele differences", "Number of mismatched HLA alleles", "numeric", "pre_transplant", None),
    # --- Graft
    "stem_cell_source": Variable("Stem-cell source", "Graft source", "categorical", "pre_transplant", categories=["Bone marrow", "Peripheral blood"]),
    "cd34_dose": Variable("CD34+ dose", "CD34+ cells per kg recipient body weight", "numeric", "pre_transplant", "×10⁶/kg"),
    "cd3_dose": Variable("CD3+ dose", "CD3+ cells per kg recipient body weight", "numeric", "pre_transplant", "×10⁸/kg"),
    "cd34_cd3_ratio": Variable("CD34:CD3 dose ratio", "CD34+ dose (×10⁶/kg) divided by CD3+ dose (×10⁸/kg)", "numeric", "pre_transplant", None),
    # --- Outcomes (never used as model inputs)
    "anc_recovered": Variable("Neutrophil recovery", "ANC > 0.5×10⁹/L reached", "binary", "outcome"),
    "anc_recovery_day": Variable("Day of neutrophil recovery", "First day with ANC > 0.5×10⁹/L", "numeric", "outcome", "day"),
    "early_engraftment": Variable("Early engraftment", f"Neutrophil recovery by Day +{EARLY_ENGRAFTMENT_DAY}", "binary", "outcome"),
    "plt_recovered": Variable("Platelet recovery", "Platelets > 50×10⁹/L reached", "binary", "outcome"),
    "plt_recovery_day": Variable("Day of platelet recovery", "First day with platelets > 50×10⁹/L", "numeric", "outcome", "day"),
    "agvhd_ii_iv": Variable("Acute GvHD II–IV", "Acute graft-versus-host disease grade II–IV", "binary", "outcome"),
    "agvhd_iii_iv": Variable("Acute GvHD III–IV", "Acute graft-versus-host disease grade III–IV", "binary", "outcome"),
    "agvhd_iii_iv_day": Variable("Day of acute GvHD III–IV", "Day grade III–IV acute GvHD developed", "numeric", "outcome", "day"),
    "extensive_cgvhd": Variable("Extensive chronic GvHD", "Extensive chronic graft-versus-host disease", "binary", "outcome"),
    "relapse": Variable("Relapse", "Recurrence of the disease", "binary", "outcome"),
    "follow_up_days": Variable("Follow-up", "Days observed (if alive) or to death", "numeric", "outcome", "day"),
    "died": Variable("Died", "Death during follow-up", "binary", "outcome"),
}

PRE_TRANSPLANT_FEATURES = [k for k, v in DATA_DICTIONARY.items() if v.phase == "pre_transplant"]
OUTCOMES = [k for k, v in DATA_DICTIONARY.items() if v.phase == "outcome"]
# Default model inputs: graft, donor, HLA and disease factors with a known link to engraftment.
# Under 5×5 nested CV this set gives AUC 0.755 for logistic regression vs 0.727 with all 22 variables.
CORE_FEATURES = ["cd34_dose", "cd3_dose", "cd34_cd3_ratio", "stem_cell_source", "recipient_age", "recipient_body_mass",
                 "donor_age", "hla_match", "disease", "high_risk", "second_transplant"]

_ABO = {0: "O", 1: "A", -1: "B", 2: "AB"}
_DISEASE = {"ALL": "ALL", "AML": "AML", "chronic": "Chronic leukaemia", "lymphoma": "Lymphoma", "nonmalignant": "Non-malignant"}
_HLA = {0: "10/10", 1: "9/10", 2: "8/10", 3: "7/10"}
_NEG_POS = {0: "Negative", 1: "Positive"}


def raw_path() -> Path:
    # The original file ships with the code (CC BY 4.0, ~27 KB) so every load is reproducible offline.
    return Path(__file__).with_name("uci_bmt_raw.csv")


def fetch_raw(force: bool = False) -> pd.DataFrame:
    """Read the bundled source file; `force=True` re-downloads it from the UCI repository."""
    path = raw_path()
    if path.exists() and not force:
        return pd.read_csv(path)
    from ucimlrepo import fetch_ucirepo

    ds = fetch_ucirepo(id=UCI_ID)
    raw = pd.concat([ds.data.features, ds.data.targets], axis=1)
    raw.to_csv(path, index=False)
    return raw


def _days(series: pd.Series) -> pd.Series:
    return series.where(series < _NEVER).astype("float")


def decode(raw: pd.DataFrame) -> pd.DataFrame:
    """Turn the coded UCI table into typed, readable columns (see DATA_DICTIONARY)."""
    if len(raw) != 187:
        raise ValueError(f"Expected 187 UCI records, got {len(raw)}")
    anc_day = _days(raw["ANCrecovery"])
    df = pd.DataFrame({
        "patient_id": [f"UCI-{i:03d}" for i in range(1, len(raw) + 1)],
        "recipient_age": raw["Recipientage"].astype(float),
        "recipient_sex": raw["Recipientgender"].map({1: "Male", 0: "Female"}),
        "recipient_body_mass": raw["Rbodymass"].astype(float),
        "recipient_abo": raw["RecipientABO"].map(_ABO),
        "recipient_rh": raw["RecipientRh"].map(_NEG_POS),
        "recipient_cmv": raw["RecipientCMV"].map(_NEG_POS),
        "disease": raw["Disease"].map(_DISEASE),
        "malignant": raw["Diseasegroup"].astype(int),
        "high_risk": raw["Riskgroup"].astype(int),
        "second_transplant": raw["Txpostrelapse"].astype(int),
        "donor_age": raw["Donorage"].astype(float).round(1),
        "donor_abo": raw["DonorABO"].map(_ABO),
        "donor_cmv": raw["DonorCMV"].map(_NEG_POS),
        # Documented as "matched", but 1 marks a donor/recipient ABO difference (checked in tests).
        "abo_mismatched": raw["ABOmatch"].astype("Int64"),
        "female_to_male": raw["Gendermatch"].astype(int),
        "hla_match": raw["HLAmatch"].map(_HLA),
        # The UCI description says "0 = one difference", but cross-tabulating against HLAmatch shows the
        # code is the count itself, with -1 marking a fully matched pair: antigen + allele differences
        # equal the number of mismatched loci in every record (checked in tests).
        "hla_antigen_differences": raw["Antigen"].clip(lower=0).astype("Int64"),
        "hla_allele_differences": raw["Allele"].clip(lower=0).astype("Int64"),
        "stem_cell_source": raw["Stemcellsource"].map({1: "Peripheral blood", 0: "Bone marrow"}),
        "cd34_dose": raw["CD34kgx10d6"].astype(float),
        "cd3_dose": raw["CD3dkgx10d8"].astype(float),
        # Named CD3/CD34 in the source, but the values are CD34 dose / CD3 dose (checked in tests).
        "cd34_cd3_ratio": raw["CD3dCD34"].astype(float),
        "anc_recovered": anc_day.notna().astype(int),
        "anc_recovery_day": anc_day,
        "early_engraftment": (anc_day <= EARLY_ENGRAFTMENT_DAY).astype(int),
        "plt_recovered": raw["PLTrecovery"].lt(_NEVER).astype(int),
        "plt_recovery_day": _days(raw["PLTrecovery"]),
        "agvhd_ii_iv": raw["IIIV"].astype(int),
        # These two source columns are inverted (Yes = 0, No = 1).
        "agvhd_iii_iv": (1 - raw["aGvHDIIIIV"]).astype(int),
        "agvhd_iii_iv_day": _days(raw["time_to_aGvHD_III_IV"]).where(raw["aGvHDIIIIV"] == 0),
        "extensive_cgvhd": (1 - raw["extcGvHD"]).astype("Int64"),
        "relapse": raw["Relapse"].astype(int),
        "follow_up_days": raw["survival_time"].astype(float),
        "died": raw["survival_status"].astype(int),
    })
    return df


def quality_notes(raw: pd.DataFrame, df: pd.DataFrame) -> List[str]:
    """Inconsistencies present in the source file itself, reported instead of silently corrected."""
    notes = []
    conflict = raw["aGvHDIIIIV"].eq(1) & raw["time_to_aGvHD_III_IV"].lt(_NEVER)
    if conflict.any():
        notes.append(
            f"{int(conflict.sum())} record(s) ({', '.join(df.loc[conflict, 'patient_id'])}) are coded as no grade III–IV acute GvHD "
            "but carry an onset day; the coded flag is used and the onset day ignored."
        )
    missing = df[PRE_TRANSPLANT_FEATURES].isna().sum()
    missing = missing[missing > 0]
    if len(missing):
        notes.append("Missing pre-transplant values (imputed on the training fold only): " + ", ".join(f"{k} {v}" for k, v in missing.items()) + ".")
    return notes


def load_cohort(force_download: bool = False) -> pd.DataFrame:
    return decode(fetch_raw(force=force_download))


def dictionary_payload(df: pd.DataFrame) -> List[dict]:
    """Variable metadata plus the ranges observed in the cohort (used for out-of-distribution warnings)."""
    out = []
    for name, var in DATA_DICTIONARY.items():
        entry = {"name": name, **var.__dict__}
        if var.kind == "numeric" and name in df:
            col = df[name].dropna()
            entry.update(observed_min=float(col.min()), observed_max=float(col.max()), missing=int(df[name].isna().sum()))
        elif name in df:
            entry["missing"] = int(df[name].isna().sum())
        out.append(entry)
    return out


def summary(df: pd.DataFrame) -> dict:
    anc = df["anc_recovery_day"].dropna()
    return {
        "n_patients": int(len(df)),
        "recipient_age_range": [float(df.recipient_age.min()), float(df.recipient_age.max())],
        "anc_recovery_median_day": float(anc.median()),
        "anc_recovery_iqr": [float(anc.quantile(0.25)), float(anc.quantile(0.75))],
        "anc_never_recovered": int((df.anc_recovered == 0).sum()),
        "early_engraftment_rate": round(float(df.early_engraftment.mean()), 3),
        "recovered_by_day": {d: round(float((df.anc_recovery_day <= d).mean()), 3) for d in (14, 21, 28)},
        "log_cd34_vs_recovery_day_r": round(float(np.corrcoef(np.log(df.loc[anc.index, "cd34_dose"]), anc)[0, 1]), 3),
    }


_MISMATCHED_LOCI = {"10/10": 0, "9/10": 1, "8/10": 2, "7/10": 3}


def derive_fields(values: dict) -> dict:
    """Compute the variables that follow from others, exactly as they relate in the cohort data,
    so an intake record can never contradict itself (e.g. disease vs malignant flag)."""
    v = {k: val for k, val in values.items() if val not in (None, "")}
    if "disease" in v:
        v["malignant"] = 0 if v["disease"] == "Non-malignant" else 1
    if "donor_abo" in v and "recipient_abo" in v:
        v["abo_mismatched"] = int(v["donor_abo"] != v["recipient_abo"])
    try:
        if "cd34_dose" in v and "cd3_dose" in v and float(v["cd3_dose"]) > 0:
            v["cd34_cd3_ratio"] = round(float(v["cd34_dose"]) / float(v["cd3_dose"]), 4)
    except (TypeError, ValueError):
        pass  # reported as a type error by the validator
    loci = _MISMATCHED_LOCI.get(v.get("hla_match"))
    if loci == 0:
        v["hla_antigen_differences"] = v["hla_allele_differences"] = 0
    elif loci is not None and "hla_antigen_differences" in v:
        try:
            v["hla_allele_differences"] = loci - int(v["hla_antigen_differences"])
        except (TypeError, ValueError):
            pass
    return v


# Minimum information needed to place a new patient in the cohort's feature space; the rest is imputed.
REQUIRED_FOR_INTAKE = ["recipient_age", "recipient_sex", "disease", "donor_age", "hla_match", "stem_cell_source", "cd34_dose"]


def validate_pretransplant(values: dict, cohort: pd.DataFrame) -> tuple:
    """Check intake values against the data dictionary.

    Returns (clean_values, errors, warnings). Errors block admission (wrong type, unknown category,
    missing required field); warnings flag values outside the range the models were trained on.
    """
    clean, errors, warnings = {}, [], []
    values = derive_fields(values)
    unknown = sorted(set(values) - set(PRE_TRANSPLANT_FEATURES))
    if unknown:
        errors.append(f"Unknown variable(s): {', '.join(unknown)}")
    for name in REQUIRED_FOR_INTAKE:
        if values.get(name) in (None, ""):
            errors.append(f"{DATA_DICTIONARY[name].label} is required")
    for name in PRE_TRANSPLANT_FEATURES:
        value = values.get(name)
        if value in (None, ""):
            continue
        var = DATA_DICTIONARY[name]
        if var.kind == "categorical":
            if value not in var.categories:
                errors.append(f"{var.label} must be one of: {', '.join(var.categories)}")
                continue
            clean[name] = value
        else:
            try:
                number = float(value)
            except (TypeError, ValueError):
                errors.append(f"{var.label} must be a number")
                continue
            if var.kind == "binary" and number not in (0, 1):
                errors.append(f"{var.label} must be 0 or 1")
                continue
            if number < 0:
                errors.append(f"{var.label} cannot be negative")
                continue
            if var.kind == "numeric":
                lo, hi = cohort[name].min(), cohort[name].max()
                if not lo <= number <= hi:
                    unit = f" {var.unit}" if var.unit else ""
                    warnings.append(f"{var.label} {number:g}{unit} is outside the training cohort ({lo:g}–{hi:g}{unit}); predictions are extrapolations.")
            clean[name] = int(number) if var.kind == "binary" else number
    if clean.get("hla_allele_differences", 0) < 0:
        errors.append("HLA antigen differences cannot exceed the number of mismatched loci")
    return clean, errors, warnings


def register_dataset():
    """Write the decoded cohort as a research dataset and profile it with dictionary-driven roles.

    Generic keyword heuristics cannot tell which UCI columns are outcomes, so the target, the allowed
    features and the leakage list come from DATA_DICTIONARY instead.
    """
    from app.core.database import save_dataset_meta
    from app.core.profiler import profile_dataset

    raw = fetch_raw()
    df = decode(raw)
    path = get_settings().data_dir / f"{DATASET_ID}.csv"
    df.to_csv(path, index=False)
    profile = profile_dataset(
        df=df,
        dataset_id=DATASET_ID,
        name=f"UCI Bone Marrow Transplant: Children (N={len(df)})",
        source=CITATION,
        data_mode="research",
    )
    target = "early_engraftment"
    profile.suggested_target = target
    profile.suggested_features = list(PRE_TRANSPLANT_FEATURES)
    profile.class_distribution = {str(k): int(v) for k, v in df[target].value_counts().sort_index().items()}
    profile.potential_leakage_warnings = [
        f"{name}: {DATA_DICTIONARY[name].label} is recorded after Day 0 and would leak the outcome"
        for name in OUTCOMES if name != target
    ] + quality_notes(raw, df)
    save_dataset_meta(
        dataset_id=DATASET_ID, name=profile.name, source=profile.source, data_mode=profile.data_mode,
        filepath=str(path), row_count=profile.total_rows, col_count=profile.total_columns,
        profile_dict=profile.model_dump(),
    )
    return profile, df
