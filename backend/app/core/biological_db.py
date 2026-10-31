"""
MarrowQ Multimodal Biological Data Persistence
----------------------------------------------
Stores multimodal biological records:
- Specimens (tissue, source, timestamp, verification status)
- Blood panels (CBC, differential, biochemistry, inflammatory biomarkers)
- Bone marrow reports (aspirate, biopsy cellularity, blast %, flow cytometry, morphology)
- Genomic variants (VCF records, chromosome, position, ref/alt, gene, VAF, ClinVar, COSMIC)
"""

import json
import sqlite3
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.core.database import get_connection, DB_PATH


def init_biological_tables(db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Specimens table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biological_specimens (
        specimen_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        specimen_type TEXT NOT NULL,
        collection_timestamp TEXT NOT NULL,
        anatomical_site TEXT,
        laboratory_name TEXT,
        quality_score REAL,
        verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
        created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_specimens_patient ON biological_specimens(patient_id)")

    # Blood analysis panels (CBC, Biochemistry, Biomarkers)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS blood_panels (
        panel_id TEXT PRIMARY KEY,
        specimen_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        test_timestamp TEXT NOT NULL,
        hb REAL,
        wbc REAL,
        anc REAL,
        alc REAL,
        platelets REAL,
        reticulocytes REAL,
        creatinine REAL,
        bun REAL,
        total_bilirubin REAL,
        ast REAL,
        alt REAL,
        albumin REAL,
        ldh REAL,
        crp REAL,
        ferritin REAL,
        electrolytes_json TEXT,
        abnormalities_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (specimen_id) REFERENCES biological_specimens(specimen_id),
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_blood_panels_patient ON blood_panels(patient_id)")

    # Bone marrow aspirate & biopsy reports
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bone_marrow_reports (
        report_id TEXT PRIMARY KEY,
        specimen_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        collection_timestamp TEXT NOT NULL,
        cellularity_pct REAL,
        blast_pct REAL,
        myeloid_erythroid_ratio REAL,
        fibrosis_grade INTEGER,
        morphology_summary TEXT,
        dysplasia_lineages_count INTEGER,
        flow_cytometry_json TEXT,
        cytogenetics_karyotype TEXT,
        mrd_status TEXT,
        mrd_level REAL,
        pathologist_signature TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (specimen_id) REFERENCES biological_specimens(specimen_id),
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bm_reports_patient ON bone_marrow_reports(patient_id)")

    # Genomic variants (VCF somatic/germline)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS genomic_variants (
        variant_id TEXT PRIMARY KEY,
        specimen_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        chromosome TEXT NOT NULL,
        position INTEGER NOT NULL,
        ref_allele TEXT NOT NULL,
        alt_allele TEXT NOT NULL,
        gene_symbol TEXT NOT NULL,
        hgvs_c TEXT,
        hgvs_p TEXT,
        variant_classification TEXT,
        variant_allele_frequency REAL,
        depth_of_coverage INTEGER,
        clinvar_significance TEXT,
        cosmic_id TEXT,
        is_actionable INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (specimen_id) REFERENCES biological_specimens(specimen_id),
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_genomic_variants_patient ON genomic_variants(patient_id)")

    conn.commit()
    conn.close()


def save_specimen(specimen: Dict[str, Any], db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO biological_specimens (
            specimen_id, patient_id, specimen_type, collection_timestamp,
            anatomical_site, laboratory_name, quality_score, verification_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        specimen["specimen_id"], specimen["patient_id"], specimen["specimen_type"],
        specimen.get("collection_timestamp", datetime.now(timezone.utc).isoformat()),
        specimen.get("anatomical_site"), specimen.get("laboratory_name"),
        specimen.get("quality_score", 1.0), specimen.get("verification_status", "VERIFIED"),
        specimen.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()


def save_blood_panel(panel: Dict[str, Any], db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO blood_panels (
            panel_id, specimen_id, patient_id, test_timestamp,
            hb, wbc, anc, alc, platelets, reticulocytes,
            creatinine, bun, total_bilirubin, ast, alt, albumin, ldh, crp, ferritin,
            electrolytes_json, abnormalities_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        panel["panel_id"], panel["specimen_id"], panel["patient_id"],
        panel.get("test_timestamp", datetime.now(timezone.utc).isoformat()),
        panel.get("hb"), panel.get("wbc"), panel.get("anc"), panel.get("alc"), panel.get("platelets"), panel.get("reticulocytes"),
        panel.get("creatinine"), panel.get("bun"), panel.get("total_bilirubin"), panel.get("ast"), panel.get("alt"), panel.get("albumin"),
        panel.get("ldh"), panel.get("crp"), panel.get("ferritin"),
        json.dumps(panel.get("electrolytes") or {}), json.dumps(panel.get("abnormalities") or []),
        panel.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()


def save_bone_marrow_report(report: Dict[str, Any], db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO bone_marrow_reports (
            report_id, specimen_id, patient_id, collection_timestamp,
            cellularity_pct, blast_pct, myeloid_erythroid_ratio, fibrosis_grade,
            morphology_summary, dysplasia_lineages_count, flow_cytometry_json,
            cytogenetics_karyotype, mrd_status, mrd_level, pathologist_signature, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        report["report_id"], report["specimen_id"], report["patient_id"],
        report.get("collection_timestamp", datetime.now(timezone.utc).isoformat()),
        report.get("cellularity_pct"), report.get("blast_pct"), report.get("myeloid_erythroid_ratio"),
        report.get("fibrosis_grade", 0), report.get("morphology_summary"), report.get("dysplasia_lineages_count", 0),
        json.dumps(report.get("flow_cytometry") or {}), report.get("cytogenetics_karyotype"),
        report.get("mrd_status", "NEGATIVE"), report.get("mrd_level", 0.0),
        report.get("pathologist_signature"), report.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()


def save_genomic_variant(variant: Dict[str, Any], db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO genomic_variants (
            variant_id, specimen_id, patient_id, chromosome, position,
            ref_allele, alt_allele, gene_symbol, hgvs_c, hgvs_p,
            variant_classification, variant_allele_frequency, depth_of_coverage,
            clinvar_significance, cosmic_id, is_actionable, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        variant["variant_id"], variant["specimen_id"], variant["patient_id"],
        variant["chromosome"], variant["position"], variant["ref_allele"], variant["alt_allele"],
        variant["gene_symbol"], variant.get("hgvs_c"), variant.get("hgvs_p"),
        variant.get("variant_classification"), variant.get("variant_allele_frequency", 0.0),
        variant.get("depth_of_coverage", 100), variant.get("clinvar_significance", "Unknown"),
        variant.get("cosmic_id"), 1 if variant.get("is_actionable") else 0,
        variant.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()


def get_patient_biological_profile(patient_id: str, db_path: str = DB_PATH) -> Dict[str, Any]:
    """Retrieves the unified multimodal biological profile for a patient."""
    init_biological_tables(db_path)
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Specimens
    cursor.execute("SELECT * FROM biological_specimens WHERE patient_id = ? ORDER BY collection_timestamp DESC", (patient_id,))
    specimens = [
        {"specimen_id": r[0], "patient_id": r[1], "specimen_type": r[2], "collection_timestamp": r[3],
         "anatomical_site": r[4], "laboratory_name": r[5], "quality_score": r[6], "verification_status": r[7]}
        for r in cursor.fetchall()
    ]

    # Blood panels
    cursor.execute("SELECT * FROM blood_panels WHERE patient_id = ? ORDER BY test_timestamp DESC", (patient_id,))
    blood_panels = []
    for r in cursor.fetchall():
        blood_panels.append({
            "panel_id": r[0], "specimen_id": r[1], "patient_id": r[2], "test_timestamp": r[3],
            "hb": r[4], "wbc": r[5], "anc": r[6], "alc": r[7], "platelets": r[8], "reticulocytes": r[9],
            "creatinine": r[10], "bun": r[11], "total_bilirubin": r[12], "ast": r[13], "alt": r[14], "albumin": r[15],
            "ldh": r[16], "crp": r[17], "ferritin": r[18],
            "electrolytes": json.loads(r[19]) if r[19] else {},
            "abnormalities": json.loads(r[20]) if r[20] else []
        })

    # Bone marrow reports
    cursor.execute("SELECT * FROM bone_marrow_reports WHERE patient_id = ? ORDER BY collection_timestamp DESC", (patient_id,))
    bm_reports = []
    for r in cursor.fetchall():
        bm_reports.append({
            "report_id": r[0], "specimen_id": r[1], "patient_id": r[2], "collection_timestamp": r[3],
            "cellularity_pct": r[4], "blast_pct": r[5], "myeloid_erythroid_ratio": r[6], "fibrosis_grade": r[7],
            "morphology_summary": r[8], "dysplasia_lineages_count": r[9],
            "flow_cytometry": json.loads(r[10]) if r[10] else {},
            "cytogenetics_karyotype": r[11], "mrd_status": r[12], "mrd_level": r[13],
            "pathologist_signature": r[14]
        })

    # Genomic variants
    cursor.execute("SELECT * FROM genomic_variants WHERE patient_id = ? ORDER BY is_actionable DESC, gene_symbol ASC", (patient_id,))
    variants = []
    for r in cursor.fetchall():
        variants.append({
            "variant_id": r[0], "specimen_id": r[1], "patient_id": r[2], "chromosome": r[3],
            "position": r[4], "ref_allele": r[5], "alt_allele": r[6], "gene_symbol": r[7],
            "hgvs_c": r[8], "hgvs_p": r[9], "variant_classification": r[10],
            "variant_allele_frequency": r[11], "depth_of_coverage": r[12],
            "clinvar_significance": r[13], "cosmic_id": r[14], "is_actionable": bool(r[15])
        })

    conn.close()

    return {
        "patient_id": patient_id,
        "specimens": specimens,
        "blood_panels": blood_panels,
        "bone_marrow_reports": bm_reports,
        "genomic_variants": variants,
        "summary": {
            "total_specimens": len(specimens),
            "latest_anc": blood_panels[0]["anc"] if blood_panels else None,
            "latest_platelets": blood_panels[0]["platelets"] if blood_panels else None,
            "latest_bm_blasts": bm_reports[0]["blast_pct"] if bm_reports else None,
            "actionable_mutations": [v["gene_symbol"] for v in variants if v["is_actionable"]]
        }
    }

