import sys
import re

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    sq_count = len(re.findall(r"(?<!\\)'", line))
    dq_count = len(re.findall(r'(?<!\\)"', line))
    bq_count = len(re.findall(r"(?<!\\)`", line))
    
    if sq_count % 2 != 0:
        if line.strip().endswith(';'):
            lines[i] = line.rstrip().rstrip(';') + "';\n"
        elif line.strip().endswith(','):
            lines[i] = line.rstrip().rstrip(',') + "',\n"
        else:
            lines[i] = line.rstrip() + "'\n"
            
    elif dq_count % 2 != 0:
        if line.strip().endswith(';'):
            lines[i] = line.rstrip().rstrip(';') + '";\n'
        elif line.strip().endswith(','):
            lines[i] = line.rstrip().rstrip(',') + '",\n'
        else:
            lines[i] = line.rstrip() + '"\n'

    elif bq_count % 2 != 0:
        if line.strip().endswith(';'):
            lines[i] = line.rstrip().rstrip(';') + '`;\n'
        elif line.strip().endswith(','):
            lines[i] = line.rstrip().rstrip(',') + '`,\n'
        else:
            lines[i] = line.rstrip() + '`\n'

with open('app.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Fixed quotes in app.js')
