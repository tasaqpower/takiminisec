import os
import sys
import zipfile
import hashlib
import json
import shutil

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
pack_dir = os.path.join(repo_root, "FORMA-ADOBE-CORE-MEDIA-PACK")
zip_name = "FORMA-ADOBE-CORE-MEDIA-PACK-V1.zip"
zip_path = os.path.join(repo_root, zip_name)
sha_path = os.path.join(repo_root, zip_name + ".sha256.txt")

artifact_dir = r"C:\Users\sinan\.gemini\antigravity\brain\094b1c26-b9f9-4b08-93a4-797170dbff1b"

print(f"Building {zip_name} from {pack_dir}...")

forbidden_extensions = {".jsx", ".mogrt", ".prfpset", ".ffx", ".webm"}
forbidden_names = {"quarantine", "quarantine-failed", "toolkit", "synthetic"}

total_files = 0
extensions_count = {}
categories_count = {}
file_entries = []

# Scan pack_dir
for root, dirs, files in os.walk(pack_dir):
    for f in sorted(files):
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, pack_dir).replace("\\", "/")
        ext = os.path.splitext(f)[1].lower()

        # Strict checks against forbidden items
        if ext in forbidden_extensions:
            raise ValueError(f"FORBIDDEN EXTENSION DETECTED: {rel_path} ({ext})")
        
        lower_rel = rel_path.lower()
        for forbidden in forbidden_names:
            if forbidden in lower_rel:
                raise ValueError(f"FORBIDDEN PATH DETECTED: {rel_path} (matched '{forbidden}')")

        extensions_count[ext] = extensions_count.get(ext, 0) + 1
        total_files += 1

        top_folder = rel_path.split("/")[0] if "/" in rel_path else "root"
        categories_count[top_folder] = categories_count.get(top_folder, 0) + 1

        with open(full_path, "rb") as fp:
            file_hash = hashlib.sha256(fp.read()).hexdigest()

        file_entries.append({
            "rel_path": rel_path,
            "full_path": full_path,
            "size": os.path.getsize(full_path),
            "sha256": file_hash
        })

print(f"Total files to pack: {total_files}")
print("Extensions:", extensions_count)
print("Categories:", categories_count)

# Build ZIP
if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for entry in file_entries:
        # Store relative to root folder FORMA-ADOBE-CORE-MEDIA-PACK-V1/
        arcname = f"FORMA-ADOBE-CORE-MEDIA-PACK-V1/{entry['rel_path']}"
        zf.write(entry["full_path"], arcname=arcname)

zip_size = os.path.getsize(zip_path)
print(f"ZIP created: {zip_path} ({zip_size} bytes, {zip_size / 1024 / 1024:.2f} MB)")

# Calculate SHA256 of the ZIP file
sha256_hash = hashlib.sha256()
with open(zip_path, "rb") as f:
    for byte_block in iter(lambda: f.read(65536), b""):
        sha256_hash.update(byte_block)

zip_sha256 = sha256_hash.hexdigest()
print(f"ZIP SHA-256: {zip_sha256}")

# Write sha256.txt
sha_content = f"{zip_sha256}  {zip_name}\n"
with open(sha_path, "w", encoding="utf-8") as f:
    f.write(sha_content)

print(f"SHA-256 written to: {sha_path}")

# Verify ZIP by reading back
with zipfile.ZipFile(zip_path, "r") as zf:
    zip_namelist = zf.namelist()
    test_result = zf.testzip()
    if test_result is not None:
        raise ValueError(f"ZIP test failed on file: {test_result}")

print(f"ZIP integrity verification: PASSED (0 corrupt files in {len(zip_namelist)} entries)")

# Copy to artifacts directory
if os.path.isdir(artifact_dir):
    art_zip = os.path.join(artifact_dir, zip_name)
    art_sha = os.path.join(artifact_dir, zip_name + ".sha256.txt")
    shutil.copy2(zip_path, art_zip)
    shutil.copy2(sha_path, art_sha)
    print(f"Copied ZIP and SHA to artifact directory: {artifact_dir}")

# Write detailed summary JSON
summary = {
    "zip_name": zip_name,
    "zip_path": zip_path,
    "zip_sha256": zip_sha256,
    "zip_size_bytes": zip_size,
    "zip_size_mb": round(zip_size / (1024 * 1024), 2),
    "total_files": total_files,
    "extensions_count": extensions_count,
    "categories_count": categories_count,
    "media_breakdown": {
        "luts_cube": extensions_count.get(".cube", 0),
        "audio_wav": extensions_count.get(".wav", 0),
        "vector_svg": extensions_count.get(".svg", 0),
        "video_mp4": extensions_count.get(".mp4", 0),
        "total_media": (
            extensions_count.get(".cube", 0) +
            extensions_count.get(".wav", 0) +
            extensions_count.get(".svg", 0) +
            extensions_count.get(".mp4", 0)
        )
    },
    "zero_forbidden_checks": {
        "jsx_count": 0,
        "mogrt_count": 0,
        "prfpset_count": 0,
        "ffx_count": 0,
        "webm_count": 0,
        "quarantine_count": 0
    }
}

summary_path = os.path.join(repo_root, "delivery_zip_manifest.json")
with open(summary_path, "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("Delivery summary saved to:", summary_path)
