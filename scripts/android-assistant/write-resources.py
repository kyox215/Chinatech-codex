from pathlib import Path
import re,xml.etree.ElementTree as ET
# Current resource XML files are the source of truth. Legacy generators must not replace them.
r=Path(__file__).resolve().parents[2];res=r/'android/phone-assistant/app/src/main/res';tables=[]
for locale in ['values','values-zh','values-it']:
 table={e.get('name'):e.text or '' for e in ET.parse(res/locale/'strings.xml').getroot()};assert all(table.values());tables.append(table)
assert tables[0].keys()==tables[1].keys()==tables[2].keys()
for key in tables[0]:assert len(set(tuple(sorted(re.findall(r'%\d+\$[ds]',t[key]))) for t in tables))==1,key
print('Current three-language resources verified; files retained unchanged.')
