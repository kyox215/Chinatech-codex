"""Prepare reproducible print-only Noto instances with unambiguous Unicode cmap.
Requires fonttools==4.60.1. Input: the SHA-pinned upstream variable font.
No glyphs or code points are removed. Alias glyphs retain identical outlines
and metrics, but use separate glyph IDs so PDF ToUnicode preserves original text.
"""
import copy
import hashlib
import json
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

source = Path(sys.argv[1])
expected = 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
output = Path(__file__).resolve().parents[2] / 'server-assets/receipt'
artifacts = []
for weight in [400, 700]:
    font = instantiateVariableFont(TTFont(source), {'wght': weight}, inplace=True)
    best = font.getBestCmap()
    aliases = {}
    used = set()
    order = list(font.getGlyphOrder())
    for code, glyph in sorted(best.items()):
        if glyph not in used:
            used.add(glyph)
            continue
        name = f'{glyph}.u{code:X}'
        aliases[code] = name
        font['glyf'][name] = copy.deepcopy(font['glyf'][glyph])
        font['hmtx'][name] = font['hmtx'][glyph]
        font['vmtx'][name] = font['vmtx'][glyph]
        order.append(name)
    font.setGlyphOrder(order)
    for table in font['cmap'].tables:
        if table.isUnicode():
            for code, name in aliases.items():
                if code in table.cmap:
                    table.cmap[code] = name
    # Derivative family name; original font's OFL and provenance are retained.
    style = 'Regular' if weight == 400 else 'Bold'
    for record in font['name'].names:
        names = {1: 'ChinaTech Receipt Noto SC', 2: style, 4: f'ChinaTech Receipt Noto SC {style}', 6: f'ChinaTechReceiptNotoSC-{style}', 16: 'ChinaTech Receipt Noto SC', 17: style}
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font.recalcTimestamp = False
    path = output / f'NotoSansSC-{weight}.ttf'
    font.save(path)
    check = TTFont(path).getBestCmap()
    assert len(check) == len(best) and len(set(check.values())) == len(check)
    artifacts.append({'file': path.name, 'weight': weight, 'unicodeEntries': len(check), 'aliasGlyphsCopied': len(aliases), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
provenance = json.loads((output / 'provenance.json').read_text())
provenance['preparation'] = {'tool': 'fonttools==4.60.1', 'script': 'scripts/receipt/prepare-fonts.py', 'purpose': 'Static weights and one-to-one Unicode glyph aliases preserve PDF ToUnicode text; outlines and metrics retained.', 'artifacts': artifacts}
(output / 'provenance.json').write_text(json.dumps(provenance, indent=2)+'\n')
print(json.dumps(artifacts, indent=2))
