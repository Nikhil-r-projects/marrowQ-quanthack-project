"""Automated Test Suite for Biological Ingestion, Flow Cytometry, Vision & Genomics.
"""
import pytest
from app.core.flow_cytometry import FCSParser, FlowCytometryGatingEngine
from app.core.pathology_vision import BoneMarrowPathologyAnalyzer
from app.core.genomic_curation import GenomicCurationEngine


def test_fcs_parser_and_gating():
    engine = FlowCytometryGatingEngine()
    analysis = engine.analyze_flow_sample()

    assert analysis["total_events_acquired"] >= 1000
    assert analysis["viable_singlets"] > 0
    assert "populations" in analysis
    assert "myeloid_blasts_pct" in analysis["populations"]
    assert "mrd_assessment" in analysis
    assert analysis["mrd_assessment"]["mrd_status"] in ["POSITIVE", "NEGATIVE"]
    assert "analytical_sensitivity" in analysis["mrd_assessment"]


def test_bone_marrow_pathology_analyzer():
    analyzer = BoneMarrowPathologyAnalyzer()
    res = analyzer.analyze_smear_sample(manual_override_cellularity=55.0, manual_override_blasts=6.0)

    assert res["total_cells_counted"] == 300
    assert res["cellularity"]["percentage"] == 55.0
    assert res["cellularity"]["classification"] == "Normocellular"
    assert res["differential_counts"]["blast_percentage"] == 6.0
    assert len(res["differential_counts"]["blast_ci_95"]) == 2
    assert res["differential_counts"]["myeloid_erythroid_ratio"] > 0.0
    assert "cell_detections_overlay" in res
    assert len(res["cell_detections_overlay"]) > 0


def test_genomic_curation_engine():
    engine = GenomicCurationEngine()
    tp53_cur = engine.curate_variant("TP53", "p.Arg175His", vaf=0.38, read_depth=520)

    assert tp53_cur["gene"] == "TP53"
    assert "clinvar_annotation" in tp53_cur
    assert tp53_cur["clinvar_annotation"]["clinical_significance"] == "Pathogenic"
    assert "cosmic_registry" in tp53_cur
    assert "actionability_tier" in tp53_cur

    co_occur = engine.analyze_co_occurrence(["NPM1", "FLT3", "TP53"])
    assert len(co_occur) >= 2
    pair_names = [f["interaction_pair"] for f in co_occur]
    assert any("NPM1 + FLT3-ITD" in p for p in pair_names)
