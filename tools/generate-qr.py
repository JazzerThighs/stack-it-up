"""Regenerate static link QR images (optional development dependency: qrcode 8.2).

Run: python -m pip install qrcode==8.2
     python tools/generate-qr.py
No QR library or external image service is needed by the app.
"""
from pathlib import Path
import qrcode

output = Path(__file__).resolve().parent.parent / "web" / "images"
output.mkdir(exist_ok=True)
for name, url in [
    ("app", "https://jazzerthighs.github.io/stack-it-up/"),
    ("repository", "https://github.com/JazzerThighs/stack-it-up"),
]:
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4)
    code.add_data(url)
    code.make(fit=True)
    matrix = code.get_matrix()
    size = len(matrix)
    commands = "".join(
        f"M{x} {y}h1v1h-1z"
        for y, row in enumerate(matrix)
        for x, value in enumerate(row)
        if value
    )
    (output / f"{name}-qr.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'shape-rendering="crispEdges"><title>{url}</title>'
        f'<rect width="{size}" height="{size}" fill="white"/>'
        f'<path d="{commands}" fill="black"/></svg>\n', encoding="utf-8"
    )
