from item import item_to_json
from local import local_to_json

# local
local_excel_path = "./xls/local.xlsx"
local_json_path = "./public/assets/json/local.json"
# item
item_excel_path = "./xls/item.xlsx"
item_json_path = "./public/assets/json/item.json"

local_to_json(local_excel_path, local_json_path)
item_to_json(item_excel_path, item_json_path)