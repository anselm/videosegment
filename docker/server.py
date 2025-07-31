# server.py
from fastapi import FastAPI, UploadFile, File
import whisperx
import os
import tempfile
import subprocess

app = FastAPI()

@app.post("/asr")
async def transcribe(file: UploadFile = File(...)):
    # Save uploaded file
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_input:
        tmp_input.write(await file.read())
        input_path = tmp_input.name

    # Convert to WAV with ffmpeg
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
        wav_path = tmp_wav.name

    ffmpeg_cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path
    ]
    subprocess.run(ffmpeg_cmd, check=True)

    # Load model
    model = whisperx.load_model(
        os.environ.get("WHISPER_MODEL", "base"),
        device=os.environ.get("DEVICE", "cpu"),
        compute_type=os.environ.get("COMPUTE_TYPE", "float32")
    )

    # Transcribe
    result = model.transcribe(wav_path)

    # Clean up
    os.remove(input_path)
    os.remove(wav_path)

    return {
        "text": result.get("text", ""),
        "segments": result.get("segments", [])
    }

