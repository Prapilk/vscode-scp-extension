import os
import re
import json

def parse_add_statement(line):
    """Parses ADD(KEY, "VALUE"), ADD(KEY), or ADDPROP(KEY, "VALUE", ...) statements."""
    match = re.search(r'ADD(?:PROP)?\([^,]+,\s*"([^"]+)".*\)', line)
    if match:
        return match.group(1)
    match = re.search(r'ADD\(([^)]+)\)', line)
    if match:
        return match.group(1)
    return None

def extract_descriptions(content, keywords):
    """Extracts descriptions for a list of keywords from the wiki content."""
    descriptions = {}
    lines = content.splitlines()
    for i, line in enumerate(lines):
        # A keyword is often just the word on a line by itself
        cleaned_line = line.strip().upper()
        if cleaned_line in keywords:
            # Found a keyword. The description is likely the next non-empty line(s).
            description = ""
            for j in range(i + 1, min(i + 10, len(lines))):
                next_line = lines[j].strip()
                if not next_line or next_line.upper() in keywords:
                    break # Stop if we hit another keyword or an empty line
                if next_line.startswith('==') or next_line.startswith('--'):
                    break # Stop at section breaks
                description += next_line + " "
            if description:
                descriptions[cleaned_line] = description.strip()
    return descriptions

def extract_trigger_descriptions(content):
    """Extracts descriptions for triggers (ON=@...)."""
    descriptions = {}
    # This regex looks for ON=@TRIGGERNAME followed by text on the same or next lines.
    matches = re.findall(r'ON=@([a-zA-Z0-9_]+)\s*([^\n\r]+(?:\n(?!\n)[^\n\r]+)*)', content, re.IGNORECASE)
    for match in matches:
        trigger_name = match[0].upper()
        description = re.sub(r'\s+', ' ', match[1]).strip()
        if description and len(description) > 5:
            descriptions[trigger_name] = description
    return descriptions

def main():
    project_root = os.path.dirname(os.path.abspath(__file__))
    tables_dir = os.path.join(project_root, 'Tables')
    output_file = os.path.join(project_root, 'src', 'autocompleteData.ts')
    wiki_file = os.path.join(tables_dir, 'wiki_content.txt')

    # --- Step 1: Parse .tbl files for lists of all items ---
    props = {}
    funcs = {}
    triggers = []
    class_names = []

    for filename in os.listdir(tables_dir):
        if not filename.endswith('.tbl'):
            continue
        filepath = os.path.join(tables_dir, filename)
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        if filename == 'triggers.tbl':
            for line in content.splitlines():
                item = parse_add_statement(line)
                if item: triggers.append(item)
            continue

        if filename == 'classnames.tbl':
            for line in content.splitlines():
                if line.strip().startswith('ADD'):
                    match = re.search(r'ADD\(([^,]+),\s*"([^"]+)"\)', line)
                    if match: class_names.append(match.group(1))
            continue

        base_name = filename.replace('.tbl', '')
        is_props = base_name.endswith('_props')
        is_funcs = base_name.endswith('_functions')
        if not (is_props or is_funcs): continue

        class_name = base_name[:-6] if is_props else base_name[:-10]
        if class_name not in props: props[class_name] = []
        if class_name not in funcs: funcs[class_name] = []

        for line in content.splitlines():
            item = parse_add_statement(line)
            if item:
                if is_props: props[class_name].append(item)
                elif is_funcs: funcs[class_name].append(item)

    # --- Step 2: Consolidate data from .tbl files ---
    char_properties, item_properties, serv_properties = [], [], []
    char_classes = ['CChar', 'CCharBase', 'CCharNpc', 'CCharPlayer', 'CClient', 'CStoneMember', 'CParty', 'CCPropsChar']
    item_classes = ['CItem', 'CItemBase', 'CItemStone', 'CCPropsItem', 'CCPropsItemChar', 'CCPropsItemEquippable', 'CCPropsItemWeapon', 'CCPropsItemWeaponRanged']
    serv_classes = ['CSector', 'CSFileObj', 'CSFileObjContainer', 'CServer']

    obj_base_props = props.get('CObjBase', []) + funcs.get('CObjBase', [])
    char_properties.extend(obj_base_props)
    item_properties.extend(obj_base_props)

    for class_name, p_list in props.items():
        if any(c in class_name for c in char_classes): char_properties.extend(p_list)
        if any(c in class_name for c in item_classes): item_properties.extend(p_list)
        if any(c in class_name for c in serv_classes): serv_properties.extend(p_list)

    for class_name, f_list in funcs.items():
        if any(c in class_name for c in char_classes): char_properties.extend(f_list)
        if any(c in class_name for c in item_classes): item_properties.extend(f_list)
        if any(c in class_name for c in serv_classes): serv_properties.extend(f_list)

    all_properties = sorted(list(set(char_properties + item_properties + serv_properties)))
    section_keywords = ['ITEMDEF', 'CHARDEF', 'FUNCTION', 'DEFMESSAGE', 'DIALOG', 'MENU', 'EVENTS', 'SKILLMENU', 'SPELL', 'TYPEDEF', 'TEMPLATE', 'REGIONRESOURCE', 'REGIONTYPE', 'SPAWN', 'SKILL', 'BOOK', 'NAMES', 'PLEVEL', 'SPEECH', 'ADVANCE', 'BLOCKIP', 'COMMENT', 'DEFNAME', 'EOF', 'WEBPAGE']

    # --- Step 3: Parse wiki_content.txt for descriptions ---
    wiki_content = ""
    if os.path.exists(wiki_file):
        with open(wiki_file, 'r', encoding='utf-8', errors='ignore') as f:
            wiki_content = f.read()

    trigger_descriptions = extract_trigger_descriptions(wiki_content)
    property_descriptions = extract_descriptions(wiki_content, all_properties)
    section_keywords_descriptions = extract_descriptions(wiki_content, section_keywords)

    # --- Step 4: Generate autocompleteData.ts ---
    def format_ts_array(data):
        return json.dumps(sorted(list(set(data))), indent=4)

    def format_ts_object(data):
        return json.dumps(data, indent=4, sort_keys=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("/* eslint-disable */\n// This file is generated by parser.py. Do not edit manually.\n\n")
        f.write("export const autocompleteData = {\n")
        f.write(f"    items: {format_ts_array([])},\n")
        f.write(f"    chars: {format_ts_array([])},\n")
        f.write(f"    triggers: {format_ts_array(triggers)},\n")
        f.write(f"    trigger_descriptions: {format_ts_object(trigger_descriptions)},\n")
        f.write(f"    property_descriptions: {format_ts_object(property_descriptions)},\n")
        f.write(f"    section_keywords_descriptions: {format_ts_object(section_keywords_descriptions)},\n")
        f.write(f"    item_properties: {format_ts_array(item_properties)},\n")
        f.write(f"    char_properties: {format_ts_array(char_properties)},\n")
        f.write(f"    serv_properties: {format_ts_array(serv_properties)},\n")
        f.write(f"    commands: {format_ts_array([])},\n")
        f.write(f"    section_keywords: {format_ts_array(section_keywords)},\n")
        
        new_properties = sorted(list(set(item_properties + char_properties)))
        argo_properties = sorted(list(set(char_properties)))
        
        f.write(f"    new_properties: {format_ts_array(new_properties)},\n")
        f.write(f"    argo_properties: {format_ts_array(argo_properties)}\n")
        f.write("};\n")

    print(f"Successfully generated {output_file} with descriptions from wiki.")

if __name__ == '__main__':
    main()
