import os
import sys
import zipfile
import hashlib
import json

ROOT_DIR = os.getcwd()
PKG_DIR = os.path.join(ROOT_DIR, "FORMA-ADOBE-ASSET-PACK-PORTABLE")

def sha256_file(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

print(f"Packaging master delivery ZIP from: {PKG_DIR}")

# 1. Master Complete Delivery ZIP
master_zip_path = os.path.join(ROOT_DIR, "FORMA-ADOBE-ASSET-PACK-PORTABLE.zip")
if os.path.exists(master_zip_path):
    os.remove(master_zip_path)

with zipfile.ZipFile(master_zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for root, dirs, files in os.walk(PKG_DIR):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, ROOT_DIR)
            zf.write(full_path, rel_path)

master_size_mb = os.path.getsize(master_zip_path) / (1024 * 1024)
master_hash = sha256_file(master_zip_path)
with open(f"{master_zip_path}.sha256.txt", "w", encoding="utf-8") as f:
    f.write(f"{master_hash}  FORMA-ADOBE-ASSET-PACK-PORTABLE.zip\n")

print(f"Master ZIP created: {master_zip_path} ({master_size_mb:.2f} MB)")
print(f"SHA-256: {master_hash}")

# 2. Modular Split ZIPs
def create_modular_zip(zip_name, asset_subdirs, extra_common_dirs=None):
    zip_path = os.path.join(ROOT_DIR, zip_name)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        # Common files
        common_files = ["README_TR.md", "install-manifest.json", "SHA256SUMS.txt"]
        for cf in common_files:
            cfp = os.path.join(PKG_DIR, cf)
            if os.path.exists(cfp):
                zf.write(cfp, os.path.join("FORMA-ADOBE-ASSET-PACK-PORTABLE", cf))
        
        # Extra common dirs
        common_dirs = ["Licenses", "Installer"] + (extra_common_dirs or [])
        for cd in common_dirs:
            cdp = os.path.join(PKG_DIR, cd)
            if os.path.exists(cdp):
                for r, _, fs in os.walk(cdp):
                    for f in fs:
                        p = os.path.join(r, f)
                        arc = os.path.relpath(p, ROOT_DIR)
                        zf.write(p, arc)

        # Asset subdirs
        for sd in asset_subdirs:
            sdp = os.path.join(PKG_DIR, sd)
            if os.path.exists(sdp):
                for r, _, fs in os.walk(sdp):
                    for f in fs:
                        p = os.path.join(r, f)
                        arc = os.path.relpath(p, ROOT_DIR)
                        zf.write(p, arc)

    sz_mb = os.path.getsize(zip_path) / (1024 * 1024)
    h = sha256_file(zip_path)
    with open(f"{zip_path}.sha256.txt", "w", encoding="utf-8") as f:
        f.write(f"{h}  {zip_name}\n")
    print(f"Modular ZIP created: {zip_name} ({sz_mb:.2f} MB) - SHA-256: {h}")
    return {"name": zip_name, "sizeMB": sz_mb, "sha256": h}

modular_zips = []
modular_zips.append(create_modular_zip("FORMA-ADOBE-LUTs.zip", ["Assets/LUTs"]))
modular_zips.append(create_modular_zip("FORMA-ADOBE-Audio.zip", ["Assets/Audio"]))
modular_zips.append(create_modular_zip("FORMA-ADOBE-MOGRT-and-Presets.zip", [
    "Assets/MOGRT", "Assets/Premiere-Presets", "Assets/After-Effects-Presets", 
    "Assets/Motion-Graphics", "Assets/Overlays", "Download-Manifests", "Reports"
]))
modular_zips.append(create_modular_zip("FORMA-ADOBE-SVG-and-Graphics.zip", ["Assets/SVG", "Assets/Video"]))

summary = {
    "masterZip": {
        "name": "FORMA-ADOBE-ASSET-PACK-PORTABLE.zip",
        "sizeMB": round(master_size_mb, 2),
        "sha256": master_hash
    },
    "modularZips": modular_zips
}

with open(os.path.join(ROOT_DIR, "delivery-packages-summary.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("\nAll delivery archives successfully created and verified!")
