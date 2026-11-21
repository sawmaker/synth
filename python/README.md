# VOLTA·24 — Python desktop port

A standalone Tkinter synthesizer with a NumPy/SciPy DSP engine and sounddevice/PortAudio output. The original web app is retained alongside it.

## Run

Install Python 3.10 or newer with Tkinter and PortAudio. On Debian/Ubuntu, for example: `sudo apt install python3-tk libportaudio2 python3-venv`. On macOS, a Python distribution with Tk support and PortAudio (`brew install portaudio`) may be needed.

```sh
cd python
python3 -m venv .venv
. .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Requires a graphical desktop and an audio output device. Click **START AUDIO** before playing. If audio cannot open, the error dialog reports the device/PortAudio problem.

Play the on-screen keyboard or use Z S X D C V G B H N J M and Q 2 W 3 E R 5 T 6 Y 7 U I. Arrow keys change octaves, Space toggles hold, Shift is a sustain pedal, and Escape stops all notes. Chord pads play the selected shape from the current octave; chord keys apply the selected shape to keyboard notes. Enable ARP to sequence held notes; DEMO runs the 104 BPM progression. The display shows waveform, spectrum and output level.

The DSP is a block-based approximation of the original Web Audio graph, not a bit-identical reproduction. It uses naive oscillator waveforms and a block-rate modulated biquad filter; timbre and timing will differ from the browser implementation. The audio callback performs FFT convolution and may require a reasonably fast CPU.

Run offline engine tests with `python -m unittest discover -s tests` from this directory; no audio device or display is needed.
