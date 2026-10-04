import openpyxl
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

docs_dir = r"D:\inventory\documents"
for f in os.listdir(docs_dir):
    if f.endswith('.xlsx'):
        path = os.path.join(docs_dir, f)
        try:
            wb = openpyxl.load_workbook(path, read_only=True)
            print(f"=== File: {f} ===")
            print("Sheets:", wb.sheetnames)
            wb.close()
        except Exception as e:
            print(f"Error loading {f}: {e}")
