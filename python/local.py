import pandas as pd
import json


def local_to_json(input_excel_path, output_json_path, all_sheets=True):

    output = {}

    if all_sheets:
        # 讀取所有工作表，指定 header=[0,1] 表示兩層欄位（MultiIndex）
        excel_data = pd.read_excel(input_excel_path, sheet_name=None, header=[0, 1])
        for sheet_name, df in excel_data.items():
            output.update(df_to_json(df))
    else:
       # 只讀第一個工作表，指定 header=[0,1] 表示兩層欄位（MultiIndex）
       df = pd.read_excel(input_excel_path, header=[0, 1])
       output.update(df_to_json(df))

    # 儲存 JSON
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("所有工作表都處理完囉～轉換完成 ✅")




def df_to_json(df):

    # 將第一欄 key 單獨抽出來
    # print(df.columns.tolist())

    output = {}

    # 準備轉換格式
    key_col = ('key', 'Unnamed: 0_level_1')

    for _, row in df.iterrows():
        key = row[key_col]
        entry = {}
        for lang in row.index.levels[0]:
            if lang == 'key': continue

            if (lang, 'lab') in row and (lang, 'des') in row:
                lab = row[(lang, 'lab')]
                des = row[(lang, 'des')]

            if pd.isna(lab) and pd.isna(des): continue

            entry[lang]={}
            if pd.notna(lab): entry[lang]['lab'] = lab
            if pd.notna(des): entry[lang]['des'] = des
            # entry[lang] = {
            #     'lab': '' if pd.isna(lab) else str(lab),
            #     'des': '' if pd.isna(des) else str(des)
            # }
        if entry:
            output[key] = entry

    return output



def unit_test():
    # 設定檔案路徑
    input_excel_path = "./xls/local.xlsx"               # 你的 Excel 
    output_json_path = "./public/assets/json/local.json"     # 輸出的 JSON 檔案名稱

    local_to_json(input_excel_path, output_json_path)



if __name__ == "__main__":
    unit_test()