import re

def extract_properties_and_functions(content, start_line):
    properties = []
    lines = content.splitlines()
    # Start from the line after the header
    i = start_line
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("--- PAGE BREAK ---"):
            break
        # The property name is the first word of the line
        match = re.match(r'^([a-zA-Z_]+)', line)
        if match:
            properties.append(match.group(1))
        i += 1
    return properties

def extract_trigger_descriptions(content):
    descriptions = {}
    lines = content.splitlines()
    trigger_regex = re.compile(r'ON=@([a-zA-Z0-9_]+)\s+(.*)')

    for line in lines:
        match = trigger_regex.match(line)
        if match:
            trigger_name = match.group(1).upper()
            description = match.group(2).strip()
            descriptions[trigger_name] = description
    return descriptions

# Read the entire file content
with open('c:\\sperecriptvisx\\wiki_content.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract Item Properties and Functions
item_properties = extract_properties_and_functions(content, 9408)
item_properties += extract_properties_and_functions(content, 13954)


# Extract Character Properties and Functions
char_properties = extract_properties_and_functions(content, 6864)
char_properties += extract_properties_and_functions(content, 8149) # Player
char_properties += extract_properties_and_functions(content, 8214) # NPC

# Extract Server Properties and Functions
server_properties = extract_properties_and_functions(content, 13954)

# Extract Triggers
character_triggers = extract_properties_and_functions(content, 7808)
item_triggers = extract_properties_and_functions(content, 9880)
region_triggers = extract_properties_and_functions(content, 10148)
room_triggers = extract_properties_and_functions(content, 13627)
all_triggers = sorted(list(set(character_triggers + item_triggers + region_triggers + room_triggers)))

# Hardcoded section keywords (from src/completion.ts)
section_keywords = ['ITEMDEF', 'CHARDEF', 'FUNCTION', 'DEFMESSAGE', 'DIALOG', 'MENU', 'EVENTS', 'SKILLMENU', 'SPELL', 'TYPEDEF', 'TEMPLATE', 'REGIONRESOURCE', 'REGIONTYPE', 'SPAWN', 'SKILL', 'BOOK', 'NAMES', 'PLEVEL', 'SPEECH', 'ADVANCE', 'BLOCKIP', 'COMMENT', 'DEFNAME', 'EOF', 'FUNCTION', 'WEBPAGE']

# Extract Trigger Descriptions
trigger_descriptions = extract_trigger_descriptions(content)


# Extract DEFNAMEs
itemdefs = re.findall(r'\[ITEMDEF\s+([a-zA-Z0-9_]+)\]', content)
itemdefs += re.findall(r'\[ITEMDEF\s+[^\\]+?\][^\\]*?DEFNAME=([a-zA-Z0-9_]+)', content, re.DOTALL)
chardefs = re.findall(r'\[CHARDEF\s+([a-zA-Z0-9_]+)\]', content)
chardefs += re.findall(r'\[CHARDEF\s+[^\\]+?\][^\\]*?DEFNAME=([a-zA-Z0-9_]+)', content, re.DOTALL)

# Extract Commands
commands = re.findall(r'\.([a-zA-Z]+)', content)


# Remove duplicates and sort
item_properties = sorted(list(set(item_properties)))
char_properties = sorted(list(set(char_properties)))
server_properties = sorted(list(set(server_properties)))
itemdefs = sorted(list(set(itemdefs)))
chardefs = sorted(list(set(chardefs)))
commands = sorted(list(set(commands)))

# Combine item and char properties for 'new.'
new_properties = sorted(list(set(item_properties + char_properties)))

# Argo properties (assuming similar to char properties for now)
argo_properties = sorted(list(set(char_properties)))


# Create the TypeScript file content
with open('c:\\sperecriptvisx\\src\\autocompleteData.ts', 'w', encoding='utf-8') as f:
    f.write("export const autocompleteData = {\n")
    f.write(f"    items: {itemdefs},\n")
    f.write(f"    chars: {chardefs},\n")
    f.write(f"    triggers: {all_triggers},\n")
    f.write(f"    trigger_descriptions: {trigger_descriptions},\n")
    f.write(f"    item_properties: {item_properties},\n")
    f.write(f"    char_properties: {char_properties},\n")
    f.write(f"    serv_properties: {server_properties},\n")
    f.write(f"    commands: {commands},\n")
    f.write(f"    section_keywords: {section_keywords},\n")
    f.write(f"    new_properties: {new_properties},\n")
    f.write(f"    argo_properties: {argo_properties}\n")
    f.write("};\n")
