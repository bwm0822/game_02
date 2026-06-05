import pandas as pd
import json


def df_to_json(df):

    output = {}

    for _, row in df.iterrows():
        obj = {}
        for key, val in row.items():
            if key.startswith("Unnamed:") or pd.isna(val) or val == "":
                continue

            if key == 'id':
                id = val
            elif key == 'gold':
                obj[key] = int(val)
            elif key == 'icon' or key == 'cat':
                obj[key] = val
            elif key.startswith("_"):
                obj.update(json.loads(f"{{{val}}}"))
            elif key == 'effects' or key == 'procs':
                obj[key] = json.loads(f"[{val}]")
            elif key == 'bb' or key.startswith('bb_'):
                obj.setdefault('bb', {}).update(json.loads(f"{{{val}}}"))
            else:
                obj[key] = json.loads(f"{{{val}}}")
        if obj:
            output[id] = obj

    return output


def excel_to_json(input_excel_path, output_json_path, all_sheets=True):
    output = {}
    if all_sheets:
        excel_data = pd.read_excel(input_excel_path, sheet_name=None)
        for _, df in excel_data.items():
            output.update(df_to_json(df))
    else:
        df = pd.read_excel(input_excel_path)
        output = df_to_json(df)

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("item 轉換完成 ✅")


def unit_test():
    input_excel_path = "./xls/item.xlsx"
    output_json_path = "./public/assets/json/item.json"
    excel_to_json(input_excel_path, output_json_path)


if __name__ == "__main__":
    unit_test()
