import pandas as pd
import json
from itertools import islice
import re


def escape_newlines_in_quotes(text):
    # 對每個 "..." 的內容做替換
    def replacer(match):
        inner = match.group(1)
        # 將其中的換行符號替換成 \n（不是換行，是字面上的 \n）
        inner_fixed = inner.replace('\n', '\\n')
        return f'"{inner_fixed}"'

    # 用正則找到所有 "..." 的片段
    return re.sub(r'"(.*?)"', replacer, text, flags=re.DOTALL)


def df_to_json(df):
    df = df.set_index(0).T  # 將第一欄設為欄位名，再轉置
    # 對所有角色資料做清理
    output = {}
    for _, row in df.iterrows():
        obj = {}
        for key, val in row.items():
            # print(f"key: {key}, val: {val}")  # Debugging line to check key and value
            # 去除多餘空格與換行
            if isinstance(val, str):
                val = val.strip()
                val = escape_newlines_in_quotes(val)

            # 特殊處理
            if pd.isna(val) or val == "":
                pass
            elif key == "id":
                id = val
            else:
                fixed = "{" + val + "}"
                # print(f"fixed: {fixed}")  # Debugging line to check fixed value
                obj[key] = json.loads(fixed)
        output[id] = obj
    return output



def excel_to_json(input_excel_path, output_json_path, all_sheets=True):
    output = {}
    if all_sheets:
        # xls = pd.ExcelFile(input_excel_path)
        # for sheet_name in xls.sheet_names:
        #     df = pd.read_excel(xls, sheet_name=sheet_name, header=None, sheet_name=None)
        #     output[sheet_name] = df_to_json(df)
        excel_data = pd.read_excel(input_excel_path, header=None, sheet_name=None)
        for sheet_name, df in excel_data.items():
            output.update(df_to_json(df))
    else:
        df = pd.read_excel(input_excel_path, header=None)
        output = df_to_json(df)

    # 儲存為 JSON
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("轉換完成！🥰")



def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/dialog.xlsx"                    # 你的 Excel 
    output_json_path = "./public/assets/json/dialog.json"     # 輸出的 JSON 檔案名稱

    excel_to_json(input_excel_path, output_json_path)



if __name__ == "__main__":
    unit_test()

