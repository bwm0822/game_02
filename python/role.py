import pandas as pd
import json


def df_to_json(df):
    df = df.set_index(0).T  # 將第一欄設為欄位名，再轉置
    # 對所有角色資料做清理
    output = {}
    for _, row in df.iterrows():
        obj = {}
        for key, val in row.items():
            # 去除多餘空格與換行
            if isinstance(val, str):
                val = val.strip()

            # 特殊處理
            if pd.isna(val) or val == "":
                continue
            elif key == "id":
                id = val
            # elif isinstance(val, str) and val.upper() == "FALSE":
            #     obj[key] = False
            # elif isinstance(val, str) and val.upper() == "TRUE":
            #     obj[key] = True
            elif key == "shape" or key == 'others':
                fixed = "{" + val + "}"
                obj.update(json.loads(fixed))
            else:
                fixed = "{" + val + "}"
                obj[key] = json.loads(fixed)
        output[id] = obj
    return output

def excel_to_json(input_excel_path, output_json_path, all_sheets=True):
    output = {}
    if all_sheets:
        excel_data = pd.read_excel(input_excel_path, header=None, sheet_name=None)
        for sheet_name, df in excel_data.items():
            output.update(df_to_json(df))
    else:
        df = pd.read_excel(input_excel_path, header=None)
        output = df_to_json(df)

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)



def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/role.xlsx"                    # 你的 Excel 
    output_json_path = "./public/assets/json/role.json"     # 輸出的 JSON 檔案名稱

    excel_to_json(input_excel_path, output_json_path)



if __name__ == "__main__":
    unit_test()

