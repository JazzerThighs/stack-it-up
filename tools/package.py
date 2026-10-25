"""Create a portable archive containing source and the compiled browser app."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import subprocess

root = Path(__file__).resolve().parent.parent
output = root.parent / "stack-it-up-rust.zip"
subprocess.run(["node", str(root / "tools" / "build.mjs")], cwd=root, check=True)
pending = output.with_suffix(".zip.tmp")
with ZipFile(pending, "w", ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob("*")):
        relative = file.relative_to(root)
        if file.is_file() and not any(p in {"target", ".git", "__pycache__"} for p in relative.parts):
            archive.write(file, Path("stack-it-up") / relative)
pending.replace(output)
print(output)
