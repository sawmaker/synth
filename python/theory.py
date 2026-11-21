"""Musical constants shared by the desktop interface and controller."""
NOTE_NAMES = ('C','C#','D','D#','E','F','F#','G','G#','A','A#','B')
CHORDS = {'MAJ': (0,4,7), 'MIN': (0,3,7), 'MAJ7': (0,4,7,11), 'MIN7': (0,3,7,10), 'DOM7': (0,4,7,10), 'SUS4': (0,5,7), 'ADD9': (0,4,7,14), 'MIN9': (0,3,7,10,14), 'DIM': (0,3,6), 'AUG': (0,4,8), '6/9': (0,4,9,14), 'STACK': (0,7,12,19)}
KEY_MAP = dict(zip('zsxdcvgbhnjm', range(12))) | dict(zip('q2w3er5t6y7ui',range(12,25))) | {',':12}
KEY_LABEL = 'Z S X D C V G B H N J M Q 2 W 3 E R 5 T 6 Y 7 U I'.split()
def frequency(midi): return 440 * 2 ** ((midi-69)/12)
def note_name(midi): return NOTE_NAMES[midi % 12] + str(midi//12-1)
