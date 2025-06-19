import pandas as pd
import json


def item_to_json(input_excel_path, output_json_path):

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
            elif key == 'gold':
                obj[key] = int(val)
            elif key == 'props' or key == 'others' or key == 'equip' or key == 'drop':
                obj[key] = json.loads(f"{{{val}}}")
            else:
                obj[key] = val
        if obj:
            output[id] = obj


        # id = row['id']
        # cat = row['cat']
        # icon = row['icon']
        # gold = row['gold']
        # row_data = row.get('props')
        # props = json.loads(f"{{{row_data}}}") if isinstance(row_data, str) and row_data.strip() else None
        # row_data = row.get('others')
        # others = json.loads(f"{{{row_data}}}") if isinstance(row_data, str) and row_data.strip() else None
        # values = {}
        # if pd.notna(cat): values['cat'] = cat
        # if pd.notna(icon): values['icon'] = icon
        # if pd.notna(gold): values['gold'] = int(gold)
        # if pd.notna(props): values['props'] = props
        # if pd.notna(others): values.update(others)
        # if values:
        #     output[id] = values

    # print(output)

    # 儲存成 JSON 檔案
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("item 轉換完成 ✅")


def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/item.xlsx"                    # 你的 Excel 
    output_json_path = "./public/assets/json/item.json"     # 輸出的 JSON 檔案名稱
    item_to_json(input_excel_path, output_json_path)


if __name__ == "__main__":
    unit_test()

