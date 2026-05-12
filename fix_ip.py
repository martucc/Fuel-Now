from PIL import Image, ImageDraw

# Fix IP logo - crop out only the "IP" letters, removing the rectangular border
source = r'C:\Users\2005n\Downloads\loghi\Gemini_Generated_Image_4alp994alp994alp.png'
dest = r'c:\Users\2005n\martucc-fuel\public\assets\logos\ip.png'

img = Image.open(source).convert('RGB')
w, h = img.size

# The rectangle border is roughly 12% in from each edge.
# We want to crop the inner content (just the IP letters) to remove the box outline.
# Crop: remove top 10%, bottom 15% (gruppo ap text), left 10%, right 10%
crop_box = (
    int(w * 0.12),   # left
    int(h * 0.05),   # top
    int(w * 0.88),   # right
    int(h * 0.80),   # bottom (cut off "GRUPPO ap" text and lower border)
)
cropped = img.crop(crop_box)

# Now find the actual content bounding box within the cropped area
gray = cropped.convert("L")
mask = gray.point(lambda p: 255 if p > 80 else 0)

# Mask the bottom-right corner watermark
draw = ImageDraw.Draw(mask)
mw, mh = mask.size
draw.rectangle([int(mw * 0.75), int(mh * 0.75), mw, mh], fill=0)

bbox = mask.getbbox()
if bbox:
    inner = cropped.crop(bbox)
    iw, ih = inner.size
    size = max(iw, ih)
    padded = int(size * 1.25)
    final = Image.new('RGB', (padded, padded), (0, 0, 0))
    offset = ((padded - iw) // 2, (padded - ih) // 2)
    final.paste(inner, offset)
    final.save(dest)
    print(f"Saved IP logo: {padded}x{padded}")
else:
    print("No content found!")
