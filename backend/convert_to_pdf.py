import os
import subprocess
import sys
import re

# Ensure markdown and xhtml2pdf are installed in virtualenv
try:
    import markdown
    from xhtml2pdf import pisa
except ImportError:
    print("Installing required libraries (markdown, xhtml2pdf)...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "markdown", "xhtml2pdf"])
    import markdown
    from xhtml2pdf import pisa

def md_to_pdf(md_path: str, pdf_path: str):
    if not os.path.exists(md_path):
        print(f"Source file not found: {md_path}")
        return False
        
    with open(md_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    # Clean up mermaid block for PDF output since xhtml2pdf doesn't render canvas charts
    mermaid_pattern = r"```mermaid.*?```"
    md_content = re.sub(
        mermaid_pattern, 
        "> **System Workflow Architecture:**\n> Ingestion (PDF/DOCX) -> Text Extraction -> Paragraph Chunking -> Embedding Model (all-MiniLM-L6-v2) -> FAISS Vector Store -> Grounded Retrieval Context -> Llama 3.2 Chat Bot Q&A",
        md_content, 
        flags=re.DOTALL
    )

    # Convert markdown to html with standard extensions
    html_content = markdown.markdown(md_content, extensions=['tables', 'fenced_code'])

    # Add professional academic stylesheet matching standard report layout
    # (Removed nested @bottom-right to prevent xhtml2pdf parser TypeError)
    styled_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <style>
        @page {{
            size: a4;
            margin: 2.5cm;
        }}
        body {{
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1e293b;
        }}
        h1 {{
            font-size: 24pt;
            text-align: center;
            margin-top: 0;
            margin-bottom: 5px;
            color: #0f172a;
        }}
        h2 {{
            font-size: 15pt;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 5px;
            margin-top: 25px;
            margin-bottom: 12px;
            color: #1e293b;
        }}
        h3 {{
            font-size: 12pt;
            margin-top: 18px;
            margin-bottom: 8px;
            color: #334155;
        }}
        p {{
            margin-top: 0;
            margin-bottom: 15px;
            text-align: justify;
        }}
        ul, ol {{
            margin-top: 0;
            margin-bottom: 15px;
            padding-left: 20px;
        }}
        li {{
            margin-bottom: 5px;
        }}
        blockquote {{
            margin: 15px 0;
            padding: 10px 15px;
            background-color: #f8fafc;
            border-left: 4px solid #6366f1;
            font-style: italic;
            color: #475569;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 9.5pt;
        }}
        th, td {{
            border: 1px solid #e2e8f0;
            padding: 8px 10px;
            text-align: left;
        }}
        th {{
            background-color: #f1f5f9;
            font-weight: bold;
            color: #0f172a;
        }}
        tr:nth-child(even) {{
            background-color: #f8fafc;
        }}
        .author {{
            text-align: center;
            font-style: italic;
            color: #475569;
            margin-bottom: 30px;
            font-size: 11pt;
        }}
        hr {{
            border: 0;
            border-top: 1px solid #cbd5e1;
            margin: 20px 0;
        }}
        code {{
            font-family: Courier, monospace;
            background-color: #f1f5f9;
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 9.5pt;
        }}
        pre {{
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 15px 0;
        }}
        pre code {{
            background-color: transparent;
            padding: 0;
        }}
    </style>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """

    # Write PDF
    with open(pdf_path, "wb") as pdf_file:
        pisa_status = pisa.CreatePDF(styled_html, dest=pdf_file)
        
    if pisa_status.err:
        print(f"Error occurred during PDF generation: {pisa_status.err}")
        return False
    print(f"PDF generated successfully at: {pdf_path}")
    return True

if __name__ == "__main__":
    # Default paths
    md_file = r"C:\Users\KHUSHI CHAUHAN\.gemini\antigravity\brain\fe7872c0-d16b-485e-b3d6-96943c681972\project_review_report.md"
    pdf_file = r"C:\Users\KHUSHI CHAUHAN\Desktop\AI Legal Document Assistant\project_review_report.pdf"
    
    if len(sys.argv) > 1:
        md_file = sys.argv[1]
    if len(sys.argv) > 2:
        pdf_file = sys.argv[2]
        
    md_to_pdf(md_file, pdf_file)
