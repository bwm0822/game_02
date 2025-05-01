import pandas as pd
import json


def local_to_json(input_excel_path, output_json_path):

    # 讀取 Excel，指定 header=[0,1] 表示兩層欄位（MultiIndex）
    df = pd.read_excel(input_excel_path, header=[0, 1])

    # 將第一欄 key 單獨抽出來
    # print(df.columns.tolist())

    # 準備轉換格式
    key_col = ('key', 'Unnamed: 0_level_1')
    output = {}

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


    # print(output)

    # 儲存成 JSON 檔案
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("local 轉換完成 ✅")

def unit_test():
    # 設定檔案路徑
    input_excel_path = "local.xlsx"     # 你的 Excel 
    output_json_path = "local.json"     # 輸出的 JSON 檔案名稱
    local_to_json(input_excel_path, output_json_path)


if __name__ == "__main__":
    unit_test()