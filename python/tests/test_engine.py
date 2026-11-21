import unittest
import numpy as np
from engine import SynthEngine, PRESETS
from theory import KEY_MAP, CHORDS

class EngineTest(unittest.TestCase):
    def test_presets(self):
        self.assertEqual(len(PRESETS),8)
        e=SynthEngine(8000)
        for i in range(8):
            e.preset(i); e.note_on(60)
            out=e.render(256)
            self.assertEqual(out.shape,(256,2)); self.assertTrue(np.isfinite(out).all()); self.assertGreater(np.max(np.abs(out)),0)
            e.panic()
    def test_release_and_voice_limit(self):
        e=SynthEngine(8000)
        for n in range(20): e.note_on(48+n)
        self.assertEqual(len(e.voices),16)
        for v in e.voices: e.note_off(v.note)
        for _ in range(60): e.render(256)
        self.assertEqual(len(e.voices),0)
    def test_theory(self):
        self.assertEqual(KEY_MAP['i'],24); self.assertEqual(len(CHORDS),12)
if __name__=='__main__': unittest.main()
