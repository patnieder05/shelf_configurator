import struct
import json
import os

filepath = os.path.join(os.path.dirname(__file__), '..', 'cad_files', '3d', 'tablar_1900x300_spezial.glb')
with open(filepath, 'rb') as f:
    f.read(12)
    c_len, _ = struct.unpack('<II', f.read(8))
    json_bytes = f.read(c_len)
    gltf = json.loads(json_bytes.decode('utf-8'))
    
    bin_len, _ = struct.unpack('<II', f.read(8))
    bin_data = f.read(bin_len)

print("Accessors:")
for i, acc in enumerate(gltf.get('accessors', [])):
    print(f"Acc {i}: type={acc.get('type')}, componentType={acc.get('componentType')}, count={acc.get('count')}, min={acc.get('min')}, max={acc.get('max')}")

# Decode position accessor if found
for mesh in gltf.get('meshes', []):
    for prim in mesh.get('primitives', []):
        pos_acc_idx = prim.get('attributes', {}).get('POSITION')
        if pos_acc_idx is not None:
            acc = gltf['accessors'][pos_acc_idx]
            bv = gltf['bufferViews'][acc['bufferView']]
            offset = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
            count = acc['count']
            fmt = '<fff'
            stride = bv.get('byteStride', 12)
            
            verts = []
            for k in range(count):
                o = offset + k * stride
                x, y, z = struct.unpack_from(fmt, bin_data, o)
                verts.append((x, y, z))
            
            xs = [v[0] for v in verts]
            ys = [v[1] for v in verts]
            zs = [v[2] for v in verts]
            print(f"\nMesh POSITION bounds:")
            print(f"X: min={min(xs):.2f}, max={max(xs):.2f}")
            print(f"Y: min={min(ys):.2f}, max={max(ys):.2f}")
            print(f"Z: min={min(zs):.2f}, max={max(zs):.2f}")
            
            # Print unique Y levels in the GLB model
            unique_ys = sorted(list(set([round(v[1], 1) for v in verts])))
            unique_xs = sorted(list(set([round(v[0], 1) for v in verts])))
            unique_zs = sorted(list(set([round(v[2], 1) for v in verts])))
            print(f"Unique Y levels in GLB: {unique_ys}")
            print(f"Unique X levels in GLB (sample): {unique_xs[:10]} ... {unique_xs[-10:]}")
            print(f"Unique Z levels in GLB: {unique_zs}")
