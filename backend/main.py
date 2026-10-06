import os
import uuid
import shutil
import json
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel

# Import local modules
import document_processor as doc_proc
import nlp_analyzer as nlp_anal
import vector_store as vec_store
import llm_client as llm

app = FastAPI(title="AI Legal Document Assistant API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
STORAGE_DIR = "storage"
UPLOAD_DIR = os.path.join(STORAGE_DIR, "uploads")
DOCUMENTS_DIR = os.path.join(STORAGE_DIR, "documents")

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    question: str

@app.get("/api/health")
async def health_check():
    """Checks the status of the API backend and the local Ollama LLM connection."""
    try:
        ollama_ok = await llm.check_ollama_status()
        ollama_status = "Connected"
    except llm.OllamaModelNotFoundError as e:
        ollama_ok = False
        ollama_status = f"Error: {str(e)}"
    except llm.OllamaConnectionError as e:
        ollama_ok = False
        ollama_status = f"Error: {str(e)}"
    except Exception as e:
        ollama_ok = False
        ollama_status = f"Unexpected Error: {str(e)}"

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "ollama": {
            "connected": ollama_ok,
            "status": ollama_status,
            "model": llm.DEFAULT_MODEL
        }
    }

@app.get("/api/documents")
async def list_documents():
    """Lists all uploaded and processed documents with their metadata."""
    docs = []
    for filename in os.listdir(DOCUMENTS_DIR):
        if filename.endswith(".json"):
            path = os.path.join(DOCUMENTS_DIR, filename)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    doc_data = json.load(f)
                # Keep payload light: remove deep elements for list view
                docs.append({
                    "id": doc_data.get("id"),
                    "filename": doc_data.get("filename"),
                    "file_size": doc_data.get("file_size"),
                    "uploaded_at": doc_data.get("uploaded_at"),
                    "parties": doc_data.get("parties", []),
                    "governing_law": doc_data.get("governing_law", "Unknown"),
                    "risk_counts": {
                        "high": sum(1 for r in doc_data.get("risks", []) if r.get("level") == "High"),
                        "medium": sum(1 for r in doc_data.get("risks", []) if r.get("level") == "Medium"),
                        "low": sum(1 for r in doc_data.get("risks", []) if r.get("level") == "Low"),
                    }
                })
            except Exception:
                continue
    # Sort by upload date descending
    docs.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return docs

@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: str):
    """Retrieves full analysis results for a specific document."""
    doc_path = os.path.join(DOCUMENTS_DIR, f"{doc_id}.json")
    if not os.path.exists(doc_path):
        raise HTTPException(status_code=404, detail="Document not found")
    
    with open(doc_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Deletes a document, its analysis, uploads, and vector index."""
    doc_path = os.path.join(DOCUMENTS_DIR, f"{doc_id}.json")
    if not os.path.exists(doc_path):
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Read to find actual file path
    with open(doc_path, "r", encoding="utf-8") as f:
        doc_data = json.load(f)
        
    file_path = doc_data.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        
    # Delete FAISS index
    vstore = vec_store.VectorStore(doc_id)
    vstore.delete()
    
    # Delete JSON metadata
    os.remove(doc_path)
    
    return {"message": "Document deleted successfully"}

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Uploads a PDF/DOCX document, extracts text, generates summary, 
    extracts clauses & risks via Ollama, parses metadata, and indexes in FAISS.
    """
    # Verify file extension
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ['.pdf', '.docx']:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")
        
    # Create unique ID
    doc_id = str(uuid.uuid4())
    
    # Save the file
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}{ext}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Get file stats
    file_size = os.path.getsize(file_path)
    
    try:
        # Extract text
        text = doc_proc.extract_text(file_path)
        if not text.strip():
            raise HTTPException(status_code=400, detail="The document seems to be empty or has no readable text.")
            
        # Segment into chunks
        chunks = doc_proc.chunk_text(text)
        
        # Build Vector Store Index
        vstore = vec_store.VectorStore(doc_id)
        vstore.build(chunks)
        
        # Run AI LLM Analyses via Ollama (Unified Single Call)
        try:
            analysis = await llm.analyze_document(text)
            summary = analysis["summary"]
            confidence_score = analysis["confidence_score"]
            parties_dict = analysis["parties"]
            governing_law = analysis["governing_law"]
            jurisdiction = analysis["jurisdiction"]
            dates = analysis["dates"]
            clauses = analysis["clauses"]
            risks = analysis["risks"]
        except (llm.OllamaConnectionError, llm.OllamaModelNotFoundError) as e:
            # Clean up files on Ollama failure since we require a working LLM
            if os.path.exists(file_path):
                os.remove(file_path)
            vstore.delete()
            raise HTTPException(
                status_code=503, 
                detail=f"Ollama AI Error: {str(e)}. Please make sure Ollama is installed, running and model '{llm.DEFAULT_MODEL}' is pulled."
            )
        
        # Combine everything into JSON response and save
        analysis_data = {
            "id": doc_id,
            "filename": file.filename,
            "file_size": file_size,
            "file_path": file_path,
            "uploaded_at": datetime.utcnow().isoformat(),
            "summary": summary,
            "confidence_score": confidence_score,
            "parties": [parties_dict.get("disclosing_party"), parties_dict.get("receiving_party")],
            "parties_dict": parties_dict,
            "governing_law": governing_law,
            "jurisdiction": jurisdiction,
            "dates": dates,
            "clauses": clauses,
            "risks": risks
        }
        
        analysis_path = os.path.join(DOCUMENTS_DIR, f"{doc_id}.json")
        with open(analysis_path, "w", encoding="utf-8") as f:
            json.dump(analysis_data, f, indent=2, ensure_ascii=False)
            
        return analysis_data
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up files on unexpected error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.post("/api/documents/{doc_id}/chat")
async def chat_with_document(doc_id: str, request: ChatRequest):
    """
    RAG endpoint. Searches FAISS for matching chunks, constructs context,
    and asks Ollama to generate an answer based only on the context.
    """
    doc_path = os.path.join(DOCUMENTS_DIR, f"{doc_id}.json")
    if not os.path.exists(doc_path):
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Query vector store
    vstore = vec_store.VectorStore(doc_id)
    relevant_chunks = vstore.search(request.question, top_k=4)
    
    if not relevant_chunks:
        return {"answer": "I could not find any relevant sections in the document to answer your question.", "sources": []}
        
    try:
        # Query LLM
        answer = await llm.answer_question(request.question, relevant_chunks)
        
        # Return answer with citations
        sources = [{
            "id": chunk.get("id"),
            "content": chunk.get("content")[:200] + "...",
            "score": chunk.get("score")
        } for chunk in relevant_chunks]
        
        return {
            "answer": answer,
            "sources": sources
        }
    except (llm.OllamaConnectionError, llm.OllamaModelNotFoundError) as e:
        raise HTTPException(status_code=503, detail=f"Ollama server is unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query model: {str(e)}")

@app.get("/api/documents/{doc_id}/report")
async def download_report(doc_id: str):
    """Generates a downloadable Markdown summary report for the document."""
    doc_path = os.path.join(DOCUMENTS_DIR, f"{doc_id}.json")
    if not os.path.exists(doc_path):
        raise HTTPException(status_code=404, detail="Document not found")
        
    with open(doc_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # Build a beautiful markdown report
    report = []
    report.append(f"# AI Legal Document Analysis Report")
    report.append(f"**Document Name:** {data['filename']}")
    report.append(f"**Analysis Date:** {data['uploaded_at'][:10]} {data['uploaded_at'][11:19]}")
    report.append(f"**Governing Law:** {data.get('governing_law', 'Not specified')}")
    if data.get("jurisdiction"):
        report.append(f"**Jurisdiction:** {data.get('jurisdiction')}")
    report.append("")
    
    report.append("## Executive Summary")
    report.append(data.get("summary", "No summary generated."))
    report.append("")
    
    report.append("## Key Parties Involved")
    parties_dict = data.get("parties_dict", {})
    if parties_dict:
        report.append(f"- **Disclosing Party:** {parties_dict.get('disclosing_party', 'Not specified')}")
        report.append(f"- **Receiving Party:** {parties_dict.get('receiving_party', 'Not specified')}")
    else:
        parties = data.get("parties", [])
        if parties:
            for p in parties:
                report.append(f"- {p}")
        else:
            report.append("*No specific parties extracted.*")
    report.append("")
    
    report.append("## Important Dates & Deadlines")
    dates = data.get("dates", [])
    if dates:
        for d in dates:
            report.append(f"- **{d.get('event', 'Date/Duration')}**: {d.get('value', '')} - {d.get('description', '')}")
    else:
        report.append("*No significant dates extracted.*")
    report.append("")
    
    report.append("## Key Clauses Extract")
    clauses = data.get("clauses", [])
    if clauses:
        for idx, c in enumerate(clauses):
            report.append(f"### {idx+1}. {c.get('title')} ({c.get('category')})")
            report.append(f"**Description:** {c.get('description')}")
            report.append(f"**Reference:** *\"{c.get('reference')}\"*")
            report.append("")
    else:
        report.append("*No key clauses extracted.*")
        
    report.append("## Risk & Liability Audit")
    risks = data.get("risks", [])
    if risks:
        for idx, r in enumerate(risks):
            level = r.get('level', 'Low')
            badge = "🔴" if level == "High" else "🟡" if level == "Medium" else "🟢"
            report.append(f"### {badge} {r.get('name')} [Risk Level: {level}]")
            report.append(f"**Potential Risk:** {r.get('explanation')}")
            report.append(f"**Reference:** *\"{r.get('clause')}\"*")
            report.append("")
    else:
        report.append("*No notable risks detected.*")
        
    report.append("---")
    report.append("*Disclaimer: This report is automatically generated by the AI Legal Document Assistant using natural language processing models. It is intended to assist in understanding the document and does not constitute professional legal advice.*")
    
    content = "\n".join(report)
    headers = {"Content-Disposition": f"attachment; filename={data['filename']}_legal_report.md"}
    return PlainTextResponse(content, headers=headers)
