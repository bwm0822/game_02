import pandas as pd
import json


def df_to_json(input_excel_path, output_json_path):

    # 讀取 Excel
    df = pd.read_excel(input_excel_path)

    # 準備轉換格式
    output = {}

    for _, row in df.iterrows():
        obj = {}
        for key, val in row.items():
            if key.startswith("Unnamed:") or pd.isna(val) or val == "":
                continue
            # print(key,val)

            if key == 'id':
                id = val
            elif key == 'icon' or key == 'type':
                obj[key] = val
            elif key == 'cd' or key == 'range':
                obj[key] = int(val)
            else:
                obj[key] = json.loads(f"{{{val}}}")
        if obj:
            output[id] = obj

    # print(output)

    # 儲存成 JSON 檔案
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("item 轉換完成 ✅")


def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/skill.xlsx"                    # 你的 Excel 
    output_json_path = "./public/assets/json/skill.json"     # 輸出的 JSON 檔案名稱
    df_to_json(input_excel_path, output_json_path)


if __name__ == "__main__":
    unit_test()

