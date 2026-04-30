#!/usr/bin/env python3
import json
import csv

# 读取卡牌数据
with open('src/data/cards/combat.json', 'r', encoding='utf-8') as f:
    cards = json.load(f)

# 能力价值映射（用于计算能力总值）
ABILITY_VALUES = {
    'supply': lambda v: v * 2,  # 补给值 * 2
    'draw': lambda v: v * 3,  # 抽卡值 * 3
    'max_supply': lambda v: v * 3,  # 最大补给 * 3
    'retire': lambda v: 4,  # 退役固定值
    'protect': lambda v: 5,  # 保护固定值
    'return_to_base': lambda v: 2,  # 返航固定值
    'scout': lambda v: v * 2.5,  # 侦查值 * 2.5
    'expand_shop': lambda v: v * 4,  # 商店扩容 * 4
    'quick_response': lambda v: v * 5,  # 快速整备 * 5
    'heavy_armor': lambda v: v * 3,  # 重甲值 * 3
    'goes_to_discard': lambda v: 0,  # 忽略
    'cannot_participate_in_combat': lambda v: 0,  # 忽略（后勤卡标记）
}

def get_ability_description(ability):
    """获取能力描述"""
    ability_type = ability.get('type', '')
    value = ability.get('value', '')

    if ability_type == 'supply':
        return f"补给{value}"
    elif ability_type == 'draw':
        return f"抽卡{value}"
    elif ability_type == 'max_supply':
        return f"储备+{value}"
    elif ability_type == 'retire':
        return "退役"
    elif ability_type == 'protect':
        return "幸运"
    elif ability_type == 'return_to_base':
        return "返航"
    elif ability_type == 'scout':
        return f"侦查{value}"
    elif ability_type == 'expand_shop':
        return f"扩容+{value}"
    elif ability_type == 'quick_response':
        return f"快整{value}"
    elif ability_type == 'heavy_armor':
        return f"重甲{value}"
    elif ability_type == 'goes_to_discard':
        return "战术卡"
    elif ability_type == 'cannot_participate_in_combat':
        return "后勤卡"
    else:
        return ability_type

def calculate_ability_value(ability):
    """计算能力的数值价值"""
    ability_type = ability.get('type', '')
    value = ability.get('value', 1)

    if ability_type in ABILITY_VALUES:
        return ABILITY_VALUES[ability_type](value)
    return 0

# 准备CSV数据
csv_data = []

for card in cards:
    card_id = card['id']
    name = card['name']
    shop_copies = card.get('shopCopies', 0)
    cost = card.get('cost', 0)
    redeploy_cost = card.get('redeployCost', 0)

    ground_power = card.get('groundPower', 0)
    sea_power = card.get('seaPower', 0)
    air_power = card.get('airPower', 0)
    air_slots = card.get('airSlots', 0)

    # 获取能力
    abilities = card.get('abilities', [])
    ability_descs = [get_ability_description(ab) for ab in abilities]
    ability1 = ability_descs[0] if len(ability_descs) > 0 else ''
    ability2 = ability_descs[1] if len(ability_descs) > 1 else ''
    ability3 = ability_descs[2] if len(ability_descs) > 2 else ''

    # 计算总值
    total_power = ground_power + sea_power + air_power
    ability_value = sum(calculate_ability_value(ab) for ab in abilities)
    # 航空槽位也算作价值
    if air_slots > 0:
        ability_value += air_slots * 4

    total_value = total_power + ability_value

    # 计算有效成本 e_cost = cost^1.4 + rd_cost × cost^0.6 × 1.5
    # 超线性增长模型：捕捉购买难度的非线性特性和整备成本的复合影响
    if cost > 0:
        effect_cost = cost ** 1.4 + redeploy_cost * (cost ** 0.6) * 1.5
    else:
        effect_cost = 0

    # 计算性价比（避免除以0）
    power_per_cost = round(total_power / cost, 2) if cost > 0 else 0
    power_per_ecost = round(total_power / effect_cost, 2) if effect_cost > 0 else 0
    value_per_cost = round(total_value / cost, 2) if cost > 0 else 0
    value_per_ecost = round(total_value / effect_cost, 2) if effect_cost > 0 else 0

    # 组合格式: "数值/cost | 数值/e_cost"
    power_efficiency = f"{power_per_cost} | {power_per_ecost}"
    value_efficiency = f"{value_per_cost} | {value_per_ecost}"

    # 卡牌类型
    card_category = card.get('cardCategory', '')
    unit_type = card.get('unitType', '')
    rarity = card.get('rarity', 'N')

    csv_data.append({
        'id': card_id,
        'name': name,
        'RR': rarity,
        'unit_type': unit_type,
        'CP': shop_copies,
        'CST': cost,
        'RDC': redeploy_cost,
        'e_cost': round(effect_cost, 2),
        'GP': ground_power,
        'SP': sea_power,
        'AP': air_power,
        'SLT': air_slots,
        'AB1': ability1,
        'AB2': ability2,
        'AB3': ability3,
        'TP': total_power,
        'AV': round(ability_value, 1),
        'TV': round(total_value, 1),
        'power_efficiency': power_efficiency,
        'value_efficiency': value_efficiency
    })

# 按照 CP 从高到低排序
csv_data.sort(key=lambda x: x['CP'], reverse=True)

# 写入CSV
csv_file = 'card_stats.csv'
fieldnames = [
    'id', 'name', 'RR', 'unit_type', 'CP',
    'CST', 'RDC', 'e_cost', 'GP', 'SP', 'AP', 'SLT',
    'AB1', 'AB2', 'AB3',
    'TP', 'AV', 'TV', 'power_efficiency', 'value_efficiency'
]

with open(csv_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(csv_data)

print(f"✓ 卡牌统计已保存到 {csv_file}")
print(f"✓ 共统计 {len(csv_data)} 张卡牌")
print("\n性价比最高的5张卡牌（按总价值效率）：")
print("  格式: 卡牌名 - [价值/cost | 价值/e_cost]")
# 按 value/cost 排序
sorted_by_value = sorted([c for c in csv_data if c['CST'] > 0],
                         key=lambda x: float(x['value_efficiency'].split('|')[0]), reverse=True)[:5]
for i, card in enumerate(sorted_by_value, 1):
    print(f"  {i}. {card['name']} - [{card['value_efficiency']}]")

print("\n纯火力性价比最高的5张卡牌（按火力效率）：")
print("  格式: 卡牌名 - [火力/cost | 火力/e_cost]")
sorted_by_power = sorted([c for c in csv_data if c['CST'] > 0],
                         key=lambda x: float(x['power_efficiency'].split('|')[0]), reverse=True)[:5]
for i, card in enumerate(sorted_by_power, 1):
    print(f"  {i}. {card['name']} - [{card['power_efficiency']}]")
