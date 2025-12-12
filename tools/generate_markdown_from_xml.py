
import xml.etree.ElementTree as ET
import sys
import os

def parse_adt_xml(xml_file, output_file):
    """
    Parses an ADT discovery XML file and generates a markdown file with the endpoints.

    Args:
        xml_file (str): The path to the input XML file.
        output_file (str): The path to the output markdown file.
    """
    tree = ET.parse(xml_file)
    root = tree.getroot()

    with open(output_file, 'w') as f:
        f.write("# ADT Endpoints\n\n")

        for workspace in root.findall('{http://www.w3.org/2007/app}workspace'):
            workspace_title_element = workspace.find('{http://www.w3.org/2005/Atom}title')
            if workspace_title_element is not None:
                workspace_title = workspace_title_element.text
                f.write(f"## {workspace_title}\n\n")

                for collection in workspace.findall('{http://www.w3.org/2007/app}collection'):
                    collection_title_element = collection.find('{http://www.w3.org/2005/Atom}title')
                    if collection_title_element is not None:
                        collection_title = collection_title_element.text
                        collection_href = collection.get('href')
                        f.write(f"### {collection_title}\n\n")
                        f.write(f"- **URL**: `{collection_href}`\n")

                        template_links = collection.find('{http://www.sap.com/adt/compatibility}templateLinks')
                        if template_links is not None:
                            f.write("- **Operations**:\n")
                            for template_link in template_links.findall('{http://www.sap.com/adt/compatibility}templateLink'):
                                rel = template_link.get('rel')
                                template = template_link.get('template')
                                f.write(f"  - **{rel}**\n")
                                f.write(f"    - `template`: `{template}`\n")
                        f.write("\n")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python generate_markdown_from_xml.py <input_xml_file> <output_markdown_file>")
        sys.exit(1)
    
    input_xml_file = sys.argv[1]
    output_markdown_file = sys.argv[2]
    parse_adt_xml(input_xml_file, output_markdown_file)
