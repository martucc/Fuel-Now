import os
import glob
from PIL import Image, ImageChops

folder = 'public/assets/logos'

for filepath in glob.glob(os.path.join(folder, '*.png')):
    try:
        img = Image.open(filepath).convert('RGB')
        
        # Find bounding box of non-black pixels
        bg = Image.new(img.mode, img.size, (0, 0, 0))
        diff = ImageChops.difference(img, bg)
        # Convert to grayscale to get single channel bounding box
        diff = diff.convert("L")
        # Threshold to ignore minor compression artifacts near black
        diff = diff.point(lambda p: p > 10 and 255)
        bbox = diff.getbbox()
        
        if bbox:
            cropped = img.crop(bbox)
            
            w, h = cropped.size
            size = max(w, h)
            
            # Pad by 1.15 to make them larger but still fit mostly inside the circle
            padded_size = int(size * 1.15)
            
            new_img = Image.new('RGB', (padded_size, padded_size), (0, 0, 0))
            offset = ((padded_size - w) // 2, (padded_size - h) // 2)
            new_img.paste(cropped, offset)
            
            new_img.save(filepath)
            print(f"Cropped and squared {os.path.basename(filepath)}")
        else:
            print(f"Skipped {os.path.basename(filepath)} (no bbox)")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
