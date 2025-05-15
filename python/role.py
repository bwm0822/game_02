import pandas as pd
import json


# 幫每一列處理成乾淨的 dict
def clean_row(row):
    obj = {}
    for key, val in row.items():
        # 去除多餘空格與換行
        if isinstance(val, str):
            val = val.strip()

        # 特殊處理
        if pd.isna(val) or val == "":
            # obj[key] = None
            pass
        elif key == "id":
            obj[key] = val
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

    return obj


def df_to_json(df):
    df = df.set_index(0).T  # 將第一欄設為欄位名，再轉置
    # 對所有角色資料做清理
    json_data = [clean_row(row) for _, row in df.iterrows()]
    return json_data


def role_to_json(input_excel_path, output_json_path):
    output = {}
    # 讀取 Excel，記得改成你的檔名（只會讀取第一列兩欄）
    df = pd.read_excel(input_excel_path, header=None)
    
    json_data = df_to_json(df)
    print(json_data)
    output = {row["id"]: row for row in json_data}

    # 儲存為 JSON
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("轉換完成！🥰")




def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/role.xlsx"                    # 你的 Excel 
    output_json_path = "./public/assets/json/role.json"     # 輸出的 JSON 檔案名稱

    role_to_json(input_excel_path, output_json_path)



if __name__ == "__main__":
    unit_test()



# "capacity":-1,
# "items":["sword_01",
# {"id":"helmet_01","count":1},
# "chest_01","gloves_01",                                            
# "boots_01","neck_01","ring_01","torch","iron","iron",                                            
# {"id":"salt","count":10},"bag","bag","raw_meat",
# "raw_fish","bottle"]