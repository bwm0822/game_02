import pandas as pd
import json

def excel_to_json(input_excel_path, output_json_path,):
    # 讀取 Excel 中所有工作表
    xl = pd.read_excel(input_excel_path, sheet_name=None, header=None)

    output = {}

    for sheet_name, df in xl.items():
        items = []
        for row in df.index:
            for col in df.columns:
                val = df.at[row, col]
                if pd.notna(val):  # 忽略空值
                    items.append(json.loads(f"{{{val}}}"))
        output[sheet_name] = items

    # 儲存 JSON
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/ab_tree.xlsx"                    # 你的 Excel 
    output_json_path = "./public/assets/json/ab_tree.json"     # 輸出的 JSON 檔案名稱
    excel_to_json(input_excel_path, output_json_path)

if __name__ == "__main__":
    unit_test()