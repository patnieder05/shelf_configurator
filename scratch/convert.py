import base64
import os
import json

base_dir = os.path.join(os.path.dirname(__file__), '..', 'cad_files', '3d')
output_file = os.path.join(os.path.dirname(__file__), '..', 'js', 'glb-defaults.js')

files = {
    'regal': 'regal.glb',
    'tablar_300x1200': 'tablar_1200x300.glb',
    'tablar_350x1200': 'tablar_1200x350.glb',
    'tablar_300x1900': 'tablar_1900x300.glb',
    'tablar_300x2600': 'tablar_2600x300.glb'
}

result = {}

for key, filename in files.items():
    filepath = os.path.join(base_dir, filename)
    if os.path.exists(filepath):
        with open(filepath, 'rb') as f:
            data = f.read()
            result[key] = base64.b64encode(data).decode('utf-8')
            print(f"Converted {filename}: {len(data)} bytes -> base64")

js_content = f"// Embedded GLB CAD Models (Base64) for offline file:// support\nconst GLB_DEFAULTS = {json.dumps(result, indent=2)};\n"

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Successfully wrote {output_file}")
