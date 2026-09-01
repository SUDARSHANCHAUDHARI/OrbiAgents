# Local voice transcription

OrbiAgents records only after explicit consent and an operator click. Install `whisper-cli` (from whisper.cpp) and `ffmpeg` locally, then choose a local GGML `.bin` model in Fleet settings. The app never downloads a model or sends audio to a network service.

Each recording is capped at 25 MB, converted to mono 16 kHz WAV in a private temporary directory, transcribed through fixed executable arguments, and deleted immediately. Transcript retention can be disabled, limited to the current app session, or limited to 24 hours. Revoking consent or selecting no retention clears retained transcript files. Microphone permission is granted only to the trusted OrbiAgents renderer while consent and all local prerequisites are active.
