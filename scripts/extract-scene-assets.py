"""Read installed Hoop Land textures; export scene art without changing the game.

Usage: python scripts/extract-scene-assets.py path/to/data.unity3d
Requires UnityPy and Pillow. Texture IDs apply to the inspected game build.
"""
import json
import sys
from pathlib import Path
import UnityPy
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'scene-assets'
root.mkdir(exist_ok=True)
ids = {226: 'press-background', 674: 'press-table', 104: 'shooting',
       615: 'shooting-arms', 1056: 'dribbling', 563: 'idle-with-ball',
       991: 'idle-with-ball-arms', 67: 'basketball',
       194: 'coach-tie', 234: 'coach-undershirt', 958: 'coach-jacket',
       320: 'announce-table-graphic', 475: 'staff-idle', 787: 'staff-idle-alt'}
ids.update({566:'passing',405:'passing-arms',380:'dunking',830:'dunking-arms'})
ids[924]='ball-seams'
manifest = []
numbers = Image.new('RGBA', (320, 352))
number_sources = []
for obj in UnityPy.load(sys.argv[1]).objects:
    if obj.type.name != 'Texture2D':
        continue
    announcer_table = obj.assets_file.name == 'sharedassets1.assets' and obj.path_id == 85
    flight_ball = obj.assets_file.name == 'sharedassets1.assets' and obj.path_id == 75
    if (obj.assets_file.name == 'sharedassets0.assets' and obj.path_id in ids) or announcer_table or flight_ball:
        texture = obj.read()
        filename = ('announce-table' if announcer_table else 'flight-ball' if flight_ball else ids[obj.path_id]) + '.png'
        if not (root / filename).exists():
            texture.image.save(root / filename)
        manifest.append({'file': filename, 'texture': obj.path_id,
                         'sourceName': texture.m_Name, 'sourceFile': obj.assets_file.name,
                         'width': texture.m_Width, 'height': texture.m_Height})
    elif obj.assets_file.name == 'sharedassets0.assets':
        texture = obj.read()
        if texture.m_Name.startswith('jersey_numbers_'):
            number = int(texture.m_Name.rsplit('_', 1)[1])
            numbers.paste(texture.image, ((number % 10) * 32, (number // 10) * 32))
            number_sources.append({'number': number, 'texture': obj.path_id})
if len(manifest) != len(ids) + 2:
    raise RuntimeError('This game build does not contain all expected scene textures.')
if len(number_sources) != 101:
    raise RuntimeError('Missing native jersey number textures.')
if not (root / 'jersey-numbers.png').exists():
    numbers.save(root / 'jersey-numbers.png')
manifest.append({'file': 'jersey-numbers.png', 'sourceFile': 'sharedassets0.assets',
                 'width': 320, 'height': 352, 'numbers': sorted(number_sources, key=lambda n: n['number']),
                 'bodyPixelsPerUnit': 32, 'numberPixelsPerUnit': 64})
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Extracted', len(manifest), 'scene textures')
