import spacy
import re
from datetime import datetime

# Load spacy model lazily
nlp = None

def get_nlp():
    global nlp
    if nlp is None:
        try:
            nlp = spacy.load("en_core_web_sm")
        except Exception:
            # Fallback in case spacy model is not downloaded yet
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], capture_output=True)
            nlp = spacy.load("en_core_web_sm")
    return nlp

def clean_text(text: str) -> str:
    """Removes extra white spaces and tabs."""
    return re.sub(r'\s+', ' ', text).strip()

def extract_parties(text: str) -> list[str]:
    """
    Extracts signing parties from the document.
    Looks at the first 2000 characters (typically where parties are defined)
    and uses a combination of regex patterns and spaCy NER.
    """
    _nlp = get_nlp()
    # Limit to the introductory part of the document
    intro = text[:3000]
    doc = _nlp(intro)
    
    candidates = []
    
    # Method 1: Look for common party definitions
    # e.g., "between [Party] (hereinafter..." or "by and between [Party A] and [Party B]"
    patterns = [
        r"(?:between|among)\s+([^,]+?)\s*(?:,?\s*a\s+[\w\s]+(?:corporation|company|LLC))?\s*(?:\(|hereinafter|referred\s+to\s+as)",
        r"(?:between|among)\s+([^,]+?)\s*and\s+([^,]+?)(?:\(|hereinafter|referred\s+to\s+as)",
        r"entered\s+into\s+by\s+and\s+between\s+([^,]+?)\s*(?:and|,)\s*([^,]+?)(?:\(|hereinafter|referred\s+to\s+as|on\s+this)",
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, intro, re.IGNORECASE)
        for match in matches:
            for group in match.groups():
                if group:
                    cleaned = clean_text(group)
                    # Filter out short or junk terms
                    if len(cleaned) > 2 and not any(term in cleaned.lower() for term in ["this", "agreement", "party", "effective", "date"]):
                        candidates.append(cleaned)
                        
    # Method 2: Fall back to ORG and PERSON entities in the intro
    for ent in doc.ents:
        if ent.label_ in ["ORG", "PERSON"]:
            cleaned = clean_text(ent.text)
            # Remove noise
            if len(cleaned) > 3 and not any(term in cleaned.lower() for term in ["agreement", "effective date", "contract", "exhibit", "schedule", "section", "article"]):
                candidates.append(cleaned)
                
    # Deduplicate while preserving order
    seen = set()
    unique_parties = []
    for p in candidates:
        # Standardize capitalization and formatting
        p_std = p.strip().strip('"').strip("'").strip()
        # Filter typical corporate suffixes to avoid duplicate listings (e.g. "Google Inc" vs "Google")
        p_lower = p_std.lower()
        if p_lower not in seen and len(p_std) < 80:
            seen.add(p_lower)
            unique_parties.append(p_std)
            
    # If we found nothing, let's try a regex for "Party A" structure
    if not unique_parties:
        # Look for capitalized noun phrases before "AND" or "BETWEEN"
        m = re.findall(r"([A-Z][a-zA-Z0-9\s,\.\-&]{3,60})\s+(?:is|are|hereinafter)", intro)
        if m:
            unique_parties = [clean_text(x) for x in m[:3]]
            
    # Return top 4 unique parties
    return unique_parties[:4]

def extract_dates(text: str) -> list[dict]:
    """
    Extracts dates from the document, filters them, and tries to contextualize.
    Returns list of dicts: {'date': 'YYYY-MM-DD', 'raw': 'text', 'context': 'surrounding text'}
    """
    _nlp = get_nlp()
    # Process text in chunks or search for date formats via regex
    # Regex is often more reliable on OCR or scanned documents for standard formats
    date_regexes = [
        # 12 January 2024 or 12th January 2024
        r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b",
        # January 12, 2024
        r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\s*,\s*\d{4}\b",
        # MM/DD/YYYY or DD/MM/YYYY
        r"\b\d{1,2}[/\.-]\d{1,2}[/\.-]\d{4}\b",
        # YYYY-MM-DD
        r"\b\d{4}-\d{2}-\d{2}\b"
    ]
    
    extracted_dates = []
    seen_dates = set()
    
    # Use regular expressions to find dates and grab context
    for pattern in date_regexes:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            date_str = match.group(0)
            start, end = match.span()
            # Grab context (100 characters before and after)
            ctx_start = max(0, start - 80)
            ctx_end = min(len(text), end + 80)
            context = clean_text(text[ctx_start:ctx_end])
            
            # Standardize date format for key output if possible
            std_date = date_str
            for fmt in ("%d %B %Y", "%B %d, %Y", "%Y-%m-%d"):
                try:
                    # Strip ordinal suffixes like 12th, 1st
                    clean_date_str = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", date_str)
                    dt = datetime.strptime(clean_date_str, fmt)
                    std_date = dt.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            
            if std_date not in seen_dates:
                seen_dates.add(std_date)
                
                # Context classification
                category = "General"
                ctx_lower = context.lower()
                if any(x in ctx_lower for x in ["effective", "commence", "start", "commencement"]):
                    category = "Effective Date"
                elif any(x in ctx_lower for x in ["terminate", "expire", "expiration", "end date"]):
                    category = "Termination Date"
                elif any(x in ctx_lower for x in ["sign", "execution", "execute", "dated this"]):
                    category = "Execution Date"
                elif any(x in ctx_lower for x in ["due", "payment", "invoice", "payable", "day of"]):
                    category = "Payment Deadline"
                elif any(x in ctx_lower for x in ["notice", "renewal", "renew"]):
                    category = "Notice Deadline"
                    
                extracted_dates.append({
                    "date": std_date,
                    "raw": date_str,
                    "context": context,
                    "category": category
                })
                
    # Sort dates chronologically if possible
    try:
        extracted_dates.sort(key=lambda x: x["date"])
    except Exception:
        pass
        
    return extracted_dates[:15]  # Limit to top 15 relevant dates

def extract_governing_law(text: str) -> str:
    """
    Attempts to identify the governing law/jurisdiction.
    Looks for phrases like 'governed by', 'laws of', etc.
    """
    patterns = [
        r"governed\s+by\s+and\s+construed\s+in\s+accordance\s+with\s+the\s+laws\s+of\s+(?:the\s+State\s+of\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|\sand\b|\bshall\b)",
        r"laws\s+of\s+(?:the\s+State\s+of\s+)?([A-Z][a-zA-Z\s]+?)\s+shall\s+govern",
        r"jurisdiction\s+of\s+the\s+courts\s+of\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|\b)",
        r"exclusive\s+jurisdiction\s+in\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|\b)"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            law = clean_text(match.group(1))
            # Remove trailing words if it captures too much
            words = law.split()
            if len(words) > 4:
                law = " ".join(words[:4])
            return law
            
    # Simple keyword scan as backup
    scan_match = re.search(r"governing\s+law\s*:\s*([A-Za-z\s]+)", text, re.IGNORECASE)
    if scan_match:
        return clean_text(scan_match.group(1))
        
    return "Not explicitly specified"

def analyze_metadata(text: str) -> dict:
    """Combines all analysis methods to return metadata."""
    return {
        "parties": extract_parties(text),
        "dates": extract_dates(text),
        "governing_law": extract_governing_law(text)
    }
