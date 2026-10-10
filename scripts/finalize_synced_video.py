import os
import sys
import av
from fractions import Fraction

def finalize_synced_video(webm_path: str, audio_path: str, output_path: str):
    print(f"Reading video from {webm_path}...")
    print(f"Reading audio from {audio_path}...")
    
    in_v = av.open(webm_path)
    in_a = av.open(audio_path)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    out = av.open(output_path, "w")
    
    v_out = out.add_stream("libx264", rate=25, options={"preset": "veryfast", "tune": "zerolatency"})
    v_out.width = 1440
    v_out.height = 900
    v_out.pix_fmt = "yuv420p"
    
    a_out = out.add_stream("aac", rate=48000)
    resampler = av.AudioResampler(format="fltp", layout="stereo", rate=48000)
    
    v_frames = in_v.decode(video=0)
    a_frames = in_a.decode(audio=0)
    
    v_pts = 0
    a_pts = 0
    a_buffer = []
    
    v_exhausted = False
    a_exhausted = False
    
    print("Muxing video and audio with locked real-time clock synchronization...")
    step = 0
    while True:
        v_time = v_pts / 25.0
        a_time = a_pts / 48000.0
        step += 1
        
        if step % 250 == 0:
            print(f"  Progress: Video {v_time:.1f}s / Audio {a_time:.1f}s...")
        
        # Termination: when video frames are exhausted and audio is caught up
        if v_exhausted and (a_exhausted or not a_buffer or a_time >= v_time):
            break
        
        # Interleaving: advance video if behind or equal to audio
        if v_time <= a_time:
            if not v_exhausted:
                try:
                    vf = next(v_frames)
                    vf.time_base = Fraction(1, 25)
                    vf.pts = v_pts
                    v_pts += 1
                    for p in v_out.encode(vf):
                        out.mux(p)
                except StopIteration:
                    v_exhausted = True
            else:
                break
        else:
            # Advance audio
            while not a_buffer and not a_exhausted:
                try:
                    af = next(a_frames)
                    for rf in resampler.resample(af):
                        a_buffer.append(rf)
                except StopIteration:
                    a_exhausted = True
            
            if a_buffer:
                rf = a_buffer.pop(0)
                rf.time_base = Fraction(1, 48000)
                rf.pts = a_pts
                a_pts += rf.samples
                for p in a_out.encode(rf):
                    out.mux(p)
            else:
                break
    
    print("Flushing video and audio encoders...")
    for p in v_out.encode():
        out.mux(p)
    for p in a_out.encode():
        out.mux(p)
        
    out.close()
    in_v.close()
    in_a.close()
    
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n==========================================================")
    print(f"SUCCESS! Perfectly synchronized demo video saved to:")
    print(f"  -> {output_path} ({size_mb:.2f} MB)")
    print(f"  -> Final Duration: {v_pts/25.0:.2f}s (Video frames: {v_pts})")
    print(f"  -> Audio Duration: {a_pts/48000.0:.2f}s")
    print(f"==========================================================")

if __name__ == "__main__":
    rec_dir = "artifacts/synced_demo_temp/recordings"
    webm_files = [os.path.join(rec_dir, f) for f in os.listdir(rec_dir) if f.endswith(".webm")]
    if not webm_files:
        print("ERROR: No webm recording found!")
        sys.exit(1)
    
    webm_file = webm_files[0]
    audio_file = "artifacts/synced_demo_temp/master_audio.mp3"
    output_file = "artifacts/marrowq_synced_demo.mp4"
    
    finalize_synced_video(webm_file, audio_file, output_file)
