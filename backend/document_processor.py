import os
import fitz  # PyMuPDF
import docx

def extract_text_from_pdf(file_path: str) -> str:
    """Extracts all text from a PDF file page by page."""
    text = ""
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
    except Exception as e:
        raise RuntimeError(f"Error reading PDF file: {str(e)}")
    return text

def extract_text_from_docx(file_path: str) -> str:
    """Extracts all text from a DOCX file, paragraph by paragraph."""
    text = ""
    try:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            if para.text.strip():
                text += para.text + "\n"
        
        # Also extract text from tables
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_text:
                    text += " | ".join(row_text) + "\n"
    except Exception as e:
        raise RuntimeError(f"Error reading DOCX file: {str(e)}")
    return text

def extract_text(file_path: str) -> str:
    """Detects file type and extracts text."""
    _, ext = os.path.splitext(file_path.lower())
    if ext == '.pdf':
        return extract_text_from_pdf(file_path)
    elif ext == '.docx':
        return extract_text_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

def chunk_text(text: str, chunk_size: int = 800, chunk_overlap: int = 200) -> list[dict]:
    """
    Splits text into overlapping chunks.
    Each chunk is stored with its index and metadata.
    """
    chunks = []
    if not text:
        return chunks
        
    # Split text into sentences/paragraphs to avoid breaking words
    # A simple but effective chunking method
    words = text.split()
    step = chunk_size - chunk_overlap
    
    if step <= 0:
        step = chunk_size // 2
        
    for idx, i in enumerate(range(0, len(words), step)):
        chunk_words = words[i:i + chunk_size]
        chunk_content = " ".join(chunk_words)
        
        # Only keep chunks that have actual content
        if chunk_content.strip():
            chunks.append({
                "id": idx,
                "content": chunk_content,
                "word_count": len(chunk_words)
            })
            
    return chunks
