import os
import sys
import argparse

# Load .env if present
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            line_str = line.strip()
            if line_str and not line_str.startswith("#") and "=" in line_str:
                k, v = line_str.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

VOICEOVER_SCRIPT = """
Welcome to MarrowQ: a research-grounded machine learning system exploring quantum-assisted prediction of hematopoietic stem cell transplant recovery.

Delayed neutrophil engraftment significantly increases the risk of severe infections and transplant-related mortality. MarrowQ evaluates whether fidelity-based quantum-kernel support vector machines offer representational utility over classical clinical models in predicting timely neutrophil recovery by Day 28 post-transplant.

First, the Dataset Explorer profiles an 18-covariate cohort modeled after published registry distributions. Notice the automated target leakage detector, which flags post-transplant complications to guarantee pre-transplant validity.

Next, in Experiment Setup, we configure our held-out test split, select our permitted covariates, and initialize our comparative suite: Dummy Classifier, Logistic Regression, Random Forest, Classical RBF SVM, and a Qiskit Fidelity Quantum-Kernel SVM using a 2-qubit ZZ feature map.

In the Experiment Monitor, the training lifecycle executes across validation, classical fitting, and quantum statevector kernel evaluation, persisting all artifacts and metrics to SQLite.

The Results section presents an honest, empirical comparison. The Classical RBF SVM achieved 74.4% accuracy and a 0.756 AUC. The matched Classical SVM achieved 57.1%, while the Quantum-Kernel SVM achieved 42.9% accuracy with an 8-second runtime overhead. This demonstrates an honest scientific benchmark where classical baselines remain highly competitive on tabular clinical data.

In the Patient Demo, clinicians can adjust pre-transplant parameters such as CD34 cell dose or graft source to inspect live model predictions and calibrated confidence scores.

Finally, MarrowQ automatically synthesizes a cited Markdown research report detailing the cohort, leakage-safe protocol, comparative results, and clinical boundaries.

MarrowQ: grounding quantum machine learning in clinical rigor and empirical honesty.
"""

def generate_voiceover(api_key: str, voice_id: str = "JBFqnCBsd6RMkjVDRZzb", output_path: str = "artifacts/marrowq_voiceover.mp3"):
    from elevenlabs.client import ElevenLabs
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    client = ElevenLabs(api_key=api_key)
    
    print(f"Generating voiceover using ElevenLabs (Voice ID: {voice_id})...")
    audio_generator = client.text_to_speech.convert(
        voice_id=voice_id,
        text=VOICEOVER_SCRIPT.strip(),
        model_id="eleven_multilingual_v2"
    )
    
    with open(output_path, "wb") as f:
        for chunk in audio_generator:
            f.write(chunk)
            
    print(f"Voiceover successfully generated and saved to: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate MarrowQ demo voiceover using ElevenLabs")
    parser.add_argument("--api-key", default=os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("XI_API_KEY"), help="ElevenLabs API Key")
    parser.add_argument("--voice-id", default="JBFqnCBsd6RMkjVDRZzb", help="ElevenLabs Voice ID (default: George)")
    parser.add_argument("--output", default="artifacts/marrowq_voiceover.mp3", help="Output MP3 file path")
    args = parser.parse_args()

    if not args.api_key:
        print("ERROR: No ElevenLabs API Key provided. Set ELEVENLABS_API_KEY or pass --api-key <YOUR_KEY>.")
        sys.exit(1)

    generate_voiceover(args.api_key, args.voice_id, args.output)
