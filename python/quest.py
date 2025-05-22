import pandas as pd
import json

def excel_to_json(input_excel_path, output_json_path, all_sheets=True):
    output = {}
    if all_sheets:
        excel_data = pd.read_excel(input_excel_path, sheet_name=None)
        for sheet_name, df in excel_data.items():
            output[sheet_name] = df_to_json(df)
    else:
        df = pd.read_excel(input_excel_path)
        output = df_to_json(df)

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)


def df_to_json(df):
    output = {}
    for _, row in df.iterrows():
        obj = {}
        for key, val in row.items():
            if pd.isna(val) or val == "":
                continue
            elif key == "id":
                id = val
            elif key == "rewards":
                fixed = "[{" + val + "}]"
                obj.update({'rewards': json.loads(fixed)})
            else:
                obj[key] = val.strip()
        if obj: output[id] = obj
    return output
        

def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/quest.xlsx"                    # 你的 Excel 
    output_json_path = "./public/assets/json/quest.json"     # 輸出的 JSON 檔案名稱
    excel_to_json(input_excel_path, output_json_path, False)


if __name__ == "__main__":
    unit_test()
