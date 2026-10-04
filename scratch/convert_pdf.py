import fitz
import os

pdf_path = r"d:\inventory\scratch\test_out.pdf"
out_png = r"d:\inventory\scratch\test_out.png"

if os.path.exists(pdf_path):
    doc = fitz.open(pdf_path)
    print(f"Total pages: {len(doc)}")
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        pix.save(f"d:\\inventory\\scratch\\test_out_p{i+1}.png")
        print(f"Saved page {i+1} to test_out_p{i+1}.png")
