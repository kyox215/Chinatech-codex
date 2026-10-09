# Current packaging entry does not overwrite legacy delivery directories.
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('package-v3.py')),run_name='__main__')
