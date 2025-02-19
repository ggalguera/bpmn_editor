import os
import pyperclip

def read_and_format_files(file_list):
    formatted_content = []
    
    for filename in file_list:
        try:
            with open(filename, 'r', encoding='utf-8') as file:
                content = file.read()
                formatted_content.append(f"// {filename}\n{content}")
        except FileNotFoundError:
            formatted_content.append(f"// {filename}\nFile not found")
        except Exception as e:
            formatted_content.append(f"// {filename}\nError reading file: {str(e)}")
    
    return "\n".join(formatted_content)

# List of files to process
files = [
    'src/index.js',
    'src/index.html',
    'src/styles.css'
    ]
    

# Get the formatted content
result = read_and_format_files(files)
result = f'My current files are: \n{result}'
# Copy to clipboard
pyperclip.copy(result)
print("Content has been copied to clipboard!")