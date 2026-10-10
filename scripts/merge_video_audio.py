import os
import av
from PIL import Image, ImageSequence

def merge_webp_and_audio(webp_path: str, audio_path: str, output_path: str, fps: int = 10):
    print(f"Reading animated WebP from {webp_path}...")
    im = Image.open(webp_path)
    frames = []
    durations = []
    for frame in ImageSequence.Iterator(im):
        frames.append(frame.convert("RGB"))
        durations.append(frame.info.get("duration", 100))
        
    total_frames = len(frames)
    w, h = frames[0].size
    print(f"Extracted {total_frames} frames ({w}x{h}).")
    
    # Ensure dimensions are divisible by 2 for H264
    out_w = w if w % 2 == 0 else w - 1
    out_h = h if h % 2 == 0 else h - 1

    # Open input audio
    print(f"Reading audio from {audio_path}...")
    in_audio = av.open(audio_path)
    a_in_stream = in_audio.streams.audio[0]

    # Calculate target fps from average duration
    avg_duration_ms = sum(durations) / len(durations) if durations else 100
    fps = max(1, round(1000.0 / avg_duration_ms))
    print(f"Calculated FPS: {fps} (avg frame duration: {avg_duration_ms:.1f}ms)")

    out_container = av.open(output_path, "w")
    v_out_stream = out_container.add_stream("h264", rate=fps)
    v_out_stream.width = out_w
    v_out_stream.height = out_h
    v_out_stream.pix_fmt = "yuv420p"

    a_out_stream = out_container.add_stream("aac", rate=a_in_stream.rate)

    print("Encoding video frames to H264...")
    for i, frame in enumerate(frames):
        if frame.size != (out_w, out_h):
            frame = frame.crop((0, 0, out_w, out_h))
        av_frame = av.VideoFrame.from_image(frame)
        av_frame.pts = i
        for packet in v_out_stream.encode(av_frame):
            out_container.mux(packet)

    for packet in v_out_stream.encode():
        out_container.mux(packet)

    print("Muxing audio frames to AAC...")
    for frame in in_audio.decode(audio=0):
        frame.pts = None  # let encoder assign continuous timestamps
        for packet in a_out_stream.encode(frame):
            out_container.mux(packet)

    for packet in a_out_stream.encode():
        out_container.mux(packet)

    out_container.close()
    in_audio.close()
    print(f"Successfully generated merged video with voiceover: {output_path}")

if __name__ == "__main__":
    webp = r"C:\Users\nidhi\.gemini\antigravity-ide\brain\62be28dd-86f2-4d0c-8fe4-4bdfe87d3a53\marrowq_mvp_demo_1791652510036.webp"
    audio = r"C:\Users\nidhi\.gemini\antigravity-ide\brain\62be28dd-86f2-4d0c-8fe4-4bdfe87d3a53\marrowq_voiceover.mp3"
    out_mp4 = r"C:\Users\nidhi\.gemini\antigravity-ide\brain\62be28dd-86f2-4d0c-8fe4-4bdfe87d3a53\marrowq_demo_with_voiceover.mp4"
    merge_webp_and_audio(webp, audio, out_mp4)
