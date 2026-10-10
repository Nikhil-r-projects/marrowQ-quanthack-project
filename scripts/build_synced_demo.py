import os
import sys
import time
import math
import av
from elevenlabs.client import ElevenLabs
from playwright.sync_api import sync_playwright

# 1. Load Environment
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            line_str = line.strip()
            if line_str and not line_str.startswith("#") and "=" in line_str:
                k, v = line_str.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

api_key = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("XI_API_KEY")
if not api_key:
    print("ERROR: ELEVENLABS_API_KEY not found in .env or environment")
    sys.exit(1)

SCENES = [
    {
        "id": "scene_1",
        "tab_btn": "button:has-text('1. Overview')",
        "name": "Overview & Clinical Problem",
        "text": "Welcome to MarrowQ: a research-grounded clinical platform evaluating quantum machine learning for hematopoietic stem cell transplant recovery. MarrowQ tests whether quantum-kernel methods offer representational advantages in predicting Day 28 neutrophil recovery, using CIBMTR-aligned clinical covariates."
    },
    {
        "id": "scene_2",
        "tab_btn": "button:has-text('2. Dataset Explorer')",
        "name": "Cohort Explorer & Leakage Prevention",
        "text": "In the Dataset Explorer, we inspect a cohort of 500 patient records modeled after published CIBMTR distributions. Crucially, our automated Leakage Sentry flags post-transplant variables like acute graft-versus-host disease, guaranteeing strict pre-transplant predictive integrity."
    },
    {
        "id": "scene_3",
        "tab_btn": "button:has-text('3. Experiment Setup')",
        "name": "Experiment Configuration & Quantum Feature Map",
        "text": "In Experiment Setup, we establish an 80/20 train-test split and configure our models: a Baseline Dummy, Logistic Regression, Random Forest, Classical RBF Support Vector Machine, and a Qiskit Quantum-Kernel SVM utilizing a 2-qubit ZZ feature map with second-order Pauli interactions."
    },
    {
        "id": "scene_4",
        "tab_btn": "button:has-text('4. Experiment Monitor')",
        "name": "Live Telemetry & Execution Lifecycle",
        "text": "The Experiment Monitor tracks the entire pipeline lifecycle in real time: from standard scaling and classical model training to quantum kernel matrix computation and validation, persisting all telemetry and artifacts directly to SQLite."
    },
    {
        "id": "scene_5",
        "tab_btn": "button:has-text('5. Results & Validation')",
        "name": "Empirical Benchmark & Scientific Honesty",
        "text": "The Results view provides an honest empirical benchmark. The Classical RBF SVM achieved 74.4% accuracy with a 0.756 AUC. In contrast, the 2-qubit Quantum SVM achieved 42.9% accuracy with an 8-second runtime overhead. MarrowQ reports genuine clinical evidence over synthetic quantum hype."
    },
    {
        "id": "scene_6",
        "tab_btn": "button:has-text('6. Patient Demo')",
        "name": "Pre-Transplant Patient Inference",
        "text": "In the Patient Demo, clinicians evaluate individual pre-transplant profiles. Modifying donor HLA match, graft source, or CD34 cell dose instantly generates recovery probabilities, model confidence scores, and pre-transplant risk assessments across all trained models."
    },
    {
        "id": "scene_7",
        "tab_btn": "button:has-text('7. Research Report')",
        "name": "Automated Clinical Research Report",
        "text": "Finally, MarrowQ automatically generates a comprehensive, peer-review-ready markdown research report with complete methodology, comparative metrics, and clinical boundaries. MarrowQ: bringing clinical rigor, reproducibility, and transparency to quantum machine learning."
    }
]

TEMP_DIR = "artifacts/synced_demo_temp"
os.makedirs(TEMP_DIR, exist_ok=True)
client = ElevenLabs(api_key=api_key)
VOICE_ID = "JBFqnCBsd6RMkjVDRZzb" # George

def get_audio_duration(file_path):
    container = av.open(file_path)
    stream = container.streams.audio[0]
    if stream.duration and stream.time_base:
        return float(stream.duration * stream.time_base)
    elif container.duration:
        return float(container.duration / av.time_base)
    else:
        pts = 0
        for frame in container.decode(stream):
            if frame.pts:
                pts = frame.pts
        return float(pts * stream.time_base)

# Step 1: Check existing or generate scene audio files
print("--- Step 1: Checking & Generating scene audio files from ElevenLabs ---")
scene_durations = []

for i, scene in enumerate(SCENES):
    scene_file = os.path.join(TEMP_DIR, f"{scene['id']}.mp3")
    if not os.path.exists(scene_file) or os.path.getsize(scene_file) == 0:
        print(f"Generating audio for Scene {i+1}: {scene['name']}...")
        audio_gen = client.text_to_speech.convert(
            voice_id=VOICE_ID,
            text=scene["text"],
            model_id="eleven_multilingual_v2"
        )
        with open(scene_file, "wb") as f:
            for chunk in audio_gen:
                f.write(chunk)
    else:
        print(f"Found cached audio for Scene {i+1}: {scene['name']}")
    
    dur = get_audio_duration(scene_file)
    print(f"  -> {scene_file} (Duration: {dur:.2f}s)")
    scene["audio_file"] = scene_file
    scene["duration"] = dur
    scene_durations.append(dur)

total_audio_duration = sum(scene_durations)
print(f"\nTotal Audio Duration: {total_audio_duration:.2f}s across {len(SCENES)} scenes.")

# Step 2: Concatenate scene audios into one master audio file
master_audio_path = os.path.join(TEMP_DIR, "master_audio.mp3")
print(f"\n--- Step 2: Stitching master audio to {master_audio_path} ---")

output_audio = av.open(master_audio_path, mode="w")
out_stream = output_audio.add_stream("mp3")

for scene in SCENES:
    inp = av.open(scene["audio_file"])
    in_stream = inp.streams.audio[0]
    resampler = av.AudioResampler(
        format=out_stream.format,
        layout=out_stream.layout,
        rate=out_stream.rate or 44100
    )
    for packet in inp.demux(in_stream):
        for frame in packet.decode():
            for resampled_frame in resampler.resample(frame):
                for out_packet in out_stream.encode(resampled_frame):
                    output_audio.mux(out_packet)

for out_packet in out_stream.encode():
    output_audio.mux(out_packet)
output_audio.close()

final_master_dur = get_audio_duration(master_audio_path)
print(f"Master audio saved. Measured duration: {final_master_dur:.2f}s")

# Step 3: Record timed browser execution using Playwright
print("\n--- Step 3: Recording browser video paced to match each scene ---")
video_rec_dir = os.path.join(TEMP_DIR, "recordings")
os.makedirs(video_rec_dir, exist_ok=True)

# Clean previous recordings
for old_f in os.listdir(video_rec_dir):
    try:
        os.remove(os.path.join(video_rec_dir, old_f))
    except Exception:
        pass

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        record_video_dir=video_rec_dir,
        record_video_size={"width": 1440, "height": 900},
        viewport={"width": 1440, "height": 900}
    )
    page = context.new_page()
    page.goto("http://localhost:5173", wait_until="networkidle")
    time.sleep(1.0) # initial settle

    for idx, scene in enumerate(SCENES):
        target_dur = scene["duration"]
        start_t = time.time()
        print(f"Action Scene {idx+1} [{scene['name']}]: Switching to {scene['tab_btn']} (Allocated: {target_dur:.2f}s)")
        
        # Click the tab button
        try:
            page.click(scene["tab_btn"], timeout=2000)
        except Exception as e:
            print(f"  Note clicking {scene['tab_btn']}: {e}")
        
        time.sleep(1.0)
        
        # Visual actions per scene
        if scene["id"] == "scene_1":
            # Overview: scroll to pipeline flowchart, dwell, scroll back
            page.evaluate("window.scrollBy({top: 360, behavior: 'smooth'})")
            time.sleep(target_dur * 0.4)
            page.evaluate("window.scrollBy({top: -360, behavior: 'smooth'})")
            
        elif scene["id"] == "scene_2":
            # Dataset: scroll down to highlight Leakage Sentry box and sample table
            page.evaluate("window.scrollBy({top: 420, behavior: 'smooth'})")
            time.sleep(target_dur * 0.4)
            page.evaluate("window.scrollBy({top: 250, behavior: 'smooth'})")
            
        elif scene["id"] == "scene_3":
            # Experiment setup: scroll down to quantum hyperparameters
            page.evaluate("window.scrollBy({top: 350, behavior: 'smooth'})")
            time.sleep(target_dur * 0.4)
            page.evaluate("window.scrollBy({top: 250, behavior: 'smooth'})")
            
        elif scene["id"] == "scene_4":
            # Monitor: scroll down to view execution logs
            page.evaluate("window.scrollBy({top: 380, behavior: 'smooth'})")
            time.sleep(target_dur * 0.4)
            
        elif scene["id"] == "scene_5":
            # Results: inspect benchmark table then scroll down to confusion matrix
            page.evaluate("window.scrollBy({top: 420, behavior: 'smooth'})")
            time.sleep(target_dur * 0.3)
            page.evaluate("window.scrollBy({top: 280, behavior: 'smooth'})")
            
        elif scene["id"] == "scene_6":
            # Patient Demo: click Run Pipeline Inference, view score
            try:
                page.click("button:has-text('Run Pipeline Inference')", timeout=2000)
            except Exception:
                pass
            time.sleep(target_dur * 0.35)
            page.evaluate("window.scrollBy({top: 320, behavior: 'smooth'})")
            
        elif scene["id"] == "scene_7":
            # Research Report: smooth scroll through report
            page.evaluate("window.scrollBy({top: 450, behavior: 'smooth'})")
            time.sleep(target_dur * 0.35)
            page.evaluate("window.scrollBy({top: 450, behavior: 'smooth'})")
        
        # Exact remainder wait
        elapsed = time.time() - start_t
        remaining = target_dur - elapsed
        if remaining > 0:
            time.sleep(remaining)
        print(f"  Scene {idx+1} finished in {time.time() - start_t:.2f}s (Target: {target_dur:.2f}s)")

    time.sleep(1.0)
    context.close()
    browser.close()

# Step 4: Locate recorded webm video
rec_files = [os.path.join(video_rec_dir, f) for f in os.listdir(video_rec_dir) if f.endswith(".webm")]
if not rec_files:
    print("ERROR: No recorded webm file found in", video_rec_dir)
    sys.exit(1)

raw_webm_file = rec_files[0]
print(f"\nRaw recorded video saved at: {raw_webm_file}")

# Step 5: Mux video and master audio into synchronized MP4 with constant 30fps clock and zero latency
final_mp4_output = "artifacts/marrowq_synced_demo.mp4"
os.makedirs("artifacts", exist_ok=True)
print(f"\n--- Step 5: Multiplexing Video and Audio into {final_mp4_output} ---")

in_video = av.open(raw_webm_file)
in_audio = av.open(master_audio_path)

out_container = av.open(final_mp4_output, mode="w")

v_stream_in = in_video.streams.video[0]
out_v_stream = out_container.add_stream(
    "libx264",
    rate=30,
    options={"tune": "zerolatency", "preset": "veryfast"}
)
out_v_stream.width = 1440
out_v_stream.height = 900
out_v_stream.pix_fmt = "yuv420p"

a_stream_in = in_audio.streams.audio[0]
out_a_stream = out_container.add_stream("aac", rate=44100)

print("Encoding video frames with synchronized real-time clock...")
target_fps = 30
out_pts = 0
last_frame = None

for frame in in_video.decode(v_stream_in):
    cur_time = float(frame.time or 0.0)
    target_pts = int(round(cur_time * target_fps))

    # Fill any gaps with the last frame
    while out_pts < target_pts and last_frame is not None:
        f = last_frame.reformat(format="yuv420p")
        f.pts = out_pts
        for packet in out_v_stream.encode(f):
            out_container.mux(packet)
        out_pts += 1

    f = frame.reformat(format="yuv420p")
    f.pts = out_pts
    for packet in out_v_stream.encode(f):
        out_container.mux(packet)
    out_pts += 1
    last_frame = frame

# Pad video to match total audio duration
total_expected_pts = int(math.ceil(final_master_dur * target_fps))
while out_pts < total_expected_pts and last_frame is not None:
    f = last_frame.reformat(format="yuv420p")
    f.pts = out_pts
    for packet in out_v_stream.encode(f):
        out_container.mux(packet)
    out_pts += 1

for packet in out_v_stream.encode():
    out_container.mux(packet)

print(f"Encoded {out_pts} video frames ({out_pts/target_fps:.2f}s).")

print("Encoding audio track...")
for frame in in_audio.decode(audio=0):
    frame.pts = None
    for packet in out_a_stream.encode(frame):
        out_container.mux(packet)

for packet in out_a_stream.encode():
    out_container.mux(packet)

out_container.close()
in_video.close()
in_audio.close()

final_size = os.path.getsize(final_mp4_output) / (1024 * 1024)
print(f"\n========================================================")
print(f"SUCCESS! Perfectly synchronized demo video created at:")
print(f"  -> {final_mp4_output} ({final_size:.2f} MB)")
print(f"  -> Total Duration: {final_master_dur:.2f}s")
print(f"========================================================")
