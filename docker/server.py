# server.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import whisper
import os
import tempfile
import subprocess
import logging
import traceback
from subprocess import TimeoutExpired

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Global model cache
model_cache = {}

@app.get("/")
async def root():
    return {
        "service": "whisperx",
        "status": "running",
        "endpoints": ["/health", "/transcribe", "/asr"],
        "model": os.environ.get("WHISPER_MODEL", "base"),
        "device": os.environ.get("DEVICE", "cpu")
    }

def get_model():
    """Get or load the Whisper model with caching"""
    model_name = os.environ.get('WHISPER_MODEL', 'base')
    
    if model_name not in model_cache:
        logger.info(f"Loading Whisper model: {model_name}")
        try:
            model_cache[model_name] = whisper.load_model(model_name)
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    return model_cache[model_name]

@app.get("/health")
async def health_check():
    try:
        # Test model loading
        model = get_model()
        return {
            "status": "ok", 
            "service": "whisperx",
            "model": os.environ.get("WHISPER_MODEL", "base"),
            "device": os.environ.get("DEVICE", "cpu"),
            "compute_type": os.environ.get("COMPUTE_TYPE", "float32")
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "service": "whisperx", "error": str(e)}
        )

async def transcribe_internal(file: UploadFile):
    input_path = None
    wav_path = None
    
    try:
        logger.info(f"Starting transcription for file: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")
        
        # Save uploaded file
        suffix = os.path.splitext(file.filename or "video.mp4")[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_input:
            content = await file.read()
            tmp_input.write(content)
            input_path = tmp_input.name
            logger.info(f"Saved input file: {input_path}, size: {len(content)} bytes")

        # Convert to WAV with ffmpeg
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            wav_path = tmp_wav.name

        logger.info(f"Converting to WAV: {input_path} -> {wav_path}")
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path
        ]
        
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True, timeout=300)
        logger.info("FFmpeg conversion completed successfully")
        
        # Check if WAV file was created
        if not os.path.exists(wav_path):
            raise Exception("WAV file was not created by FFmpeg")
        
        wav_size = os.path.getsize(wav_path)
        logger.info(f"WAV file created: {wav_path}, size: {wav_size} bytes")
        
        if wav_size == 0:
            raise Exception("WAV file is empty")

        # Load model
        logger.info("Loading WhisperX model...")
        model = get_model()
        logger.info("Model loaded, starting transcription...")

        # Transcribe
        result = model.transcribe(wav_path)
        logger.info(f"Transcription completed, result type: {type(result)}")

        # Format response to match expected structure
        segments = result.get("segments", [])
        formatted_segments = []
        
        for segment in segments:
            formatted_segments.append({
                "start": segment.get("start", 0),
                "end": segment.get("end", 0),
                "text": segment.get("text", "").strip()
            })
        
        response = {
            "text": result.get("text", ""),
            "segments": formatted_segments
        }
        
        logger.info(f"Transcription successful: {len(formatted_segments)} segments, {len(response['text'])} characters")
        return response

    except subprocess.CalledProcessError as e:
        error_msg = f"FFmpeg conversion failed: {e.stderr}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
    except subprocess.TimeoutExpired as e:
        error_msg = f"FFmpeg conversion timed out after 5 minutes"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        error_msg = f"Transcription failed: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)
    finally:
        # Clean up temporary files
        try:
            if input_path and os.path.exists(input_path):
                os.remove(input_path)
                logger.info(f"Cleaned up input file: {input_path}")
        except Exception as e:
            logger.warning(f"Failed to clean up input file: {e}")
        
        try:
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
                logger.info(f"Cleaned up WAV file: {wav_path}")
        except Exception as e:
            logger.warning(f"Failed to clean up WAV file: {e}")

@app.post("/asr")
async def transcribe_asr(file: UploadFile = File(...)):
    return await transcribe_internal(file)

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    return await transcribe_internal(file)

