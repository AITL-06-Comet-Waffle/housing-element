import csv
import json
import os

input_files = [
    '/Users/aramay/Documents/codesmith_AIML/housing-element/scripts/ca_apr_data/tablea.csv',
    '/Users/aramay/Documents/codesmith_AIML/housing-element/scripts/ca_apr_data/tablea2.csv'
]
output_file = '/Users/aramay/Documents/codesmith_AIML/housing-element/scripts/pinecone/apr_notes.jsonl'

def process_files():
    total_formatted = 0
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as out_f:
        for file_path in input_files:
            if not os.path.exists(file_path):
                print(f"File not found: {file_path}")
                continue
                
            with open(file_path, 'r', encoding='utf-8', errors='replace') as in_f:
                reader = csv.DictReader(in_f)
                for row in reader:
                    note = row.get('NOTES', '').strip()
                    if note and note.lower() not in ('nan', 'none', 'null'):
                        data = {
                            "text": note,
                            "metadata": {
                                "JURIS_NAME": row.get("JURIS_NAME", "").strip(),
                                "YEAR": row.get("YEAR", "").strip(),
                                "PROJECT_NAME": row.get("PROJECT_NAME", "").strip()
                            }
                        }
                        out_f.write(json.dumps(data) + '\n')
                        total_formatted += 1
                        
    print(f"Total lines formatted: {total_formatted}")

if __name__ == "__main__":
    process_files()
