from PIL import Image, ImageDraw

source = r'C:\Users\2005n\.gemini\antigravity\brain\d8a3e183-3fb0-4860-9f34-13b66b1fdd5a\generic_logo_1778597507007.png'
dest = r'c:\Users\2005n\martucc-fuel\public\assets\logos\generic.png'

try:
    img = Image.open(source).convert('RGB')
    
    gray = img.convert("L")
    mask = gray.point(lambda p: 255 if p > 80 else 0)
    
    bbox = mask.getbbox()
    if bbox:
        cropped = img.crop(bbox)
        cw, ch = cropped.size
        size = max(cw, ch)
        padded_size = int(size * 1.25)
        new_img = Image.new('RGB', (padded_size, padded_size), (0, 0, 0))
        offset = ((padded_size - cw) // 2, (padded_size - ch) // 2)
        new_img.paste(cropped, offset)
        new_img.save(dest)
        print("Cropped and saved generic.png")
    else:
        print("No content found")
except Exception as e:
    print("Error:", e)
