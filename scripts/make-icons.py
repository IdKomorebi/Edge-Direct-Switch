"""Generate the project's geometric icon locally; Pillow is only needed by maintainers."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1] / 'extension' / 'icons'
root.mkdir(exist_ok=True)
image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
d = ImageDraw.Draw(image)
d.rounded_rectangle((0, 0, 511, 511), radius=112, fill='#087f70')
d.line([(104, 350), (222, 350), (222, 170), (390, 170)], fill='white', width=38, joint='curve')
d.line([(250, 350), (390, 350)], fill='#91d3b8', width=30)
d.polygon([(356, 116), (416, 170), (356, 224)], fill='white')
d.ellipse((77, 321, 135, 379), fill='white')
for size in (16, 32, 48, 128):
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f'{size}.png')
