import os
import glob
from PIL import Image, ImageChops

folder = 'public/assets/logos'

for filepath in glob.glob(os.path.join(folder, '*.png')):
    try:
        img = Image.open(filepath).convert('RGB')
        
        # Convert to grayscale to evaluate brightness
        gray = img.convert("L")
        
        # High threshold to only keep the bright white logo parts, ignoring dark grey backgrounds/borders
        mask = gray.point(lambda p: 255 if p > 80 else 0)
        
        bbox = mask.getbbox()
        
        if bbox:
            cropped = img.crop(bbox)
            
            w, h = cropped.size
            size = max(w, h)
            
            # Pad by 1.25 to make them look perfectly sized inside the circle (CSS scale will be 1)
            padded_size = int(size * 1.25)
            
            new_img = Image.new('RGB', (padded_size, padded_size), (0, 0, 0))
            offset = ((padded_size - w) // 2, (padded_size - h) // 2)
            new_img.paste(cropped, offset)
            
            new_img.save(filepath)
            print(f"Cropped and squared {os.path.basename(filepath)}")
        else:
            print(f"Skipped {os.path.basename(filepath)} (no bright pixels found)")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
