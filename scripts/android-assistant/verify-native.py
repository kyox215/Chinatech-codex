# Current static verifier. Frozen 0.1/0.2 evidence remains in their delivery directories.
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('verify-v3.py')),run_name='__main__')
