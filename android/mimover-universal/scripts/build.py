from pathlib import Path
import subprocess,sys
here=Path(__file__).resolve().parent
(here.parents[2]/'.local/mimover-universal-next').mkdir(parents=True,exist_ok=True)
for name in ['generate-resources.py','build-native.py','merge-resources.py','package-lab2.py','verify-artifact.py']:
 subprocess.run([sys.executable,str(here/name)],check=True)
