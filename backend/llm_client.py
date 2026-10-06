import httpx
import json
import re
import os

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2"

# Retrieve Gemini API Key from environment variables (for cloud deployments)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

class OllamaConnectionError(Exception):
    pass

class OllamaModelNotFoundError(Exception):
    pass

async def check_ollama_status() -> bool:
    """Checks if Ollama is running (only if not using Gemini API)."""
    if GEMINI_API_KEY:
        return True # Using Gemini Cloud API, Ollama not needed
        
    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code != 200:
                return False
            
            data = response.json()
            models = [m["name"] for m in data.get("models", [])]
            has_model = any(DEFAULT_MODEL in m for m in models)
            if not has_model:
                raise OllamaModelNotFoundError(f"Model '{DEFAULT_MODEL}' is not available in Ollama. Please run 'ollama pull {DEFAULT_MODEL}'.")
            return True
        except httpx.RequestError:
            raise OllamaConnectionError("Could not connect to Ollama. Ensure Ollama service is running on http://localhost:11434.")

def clean_json_response(text: str) -> str:
    """Cleans up markdown code block formatting around JSON string."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text

async def query_gemini_api(prompt: str, system_prompt: str = "", format_json: bool = False) -> str:
    """Sends contents to Gemini 1.5 Flash API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    # Combine system prompt with user prompt
    full_prompt = prompt
    if system_prompt:
        full_prompt = f"{system_prompt}\n\nInput Document/Query:\n{prompt}"
        
    payload = {
        "contents": [{
            "parts": [{"text": full_prompt}]
        }]
    }
    
    if format_json:
        payload["generationConfig"] = {
            "responseMimeType": "application/json"
        }
        
    async with httpx.AsyncClient(timeout=45.0) as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                raise RuntimeError(f"Gemini API returned error: {response.text}")
            
            data = response.json()
            # Extract content text from Gemini response structure
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            raise RuntimeError(f"Failed to query Gemini API: {str(e)}")

async def query_llm(prompt: str, system_prompt: str = "", format_json: bool = False, temperature: float = 0.2) -> str:
    """Helper that routes queries either to Gemini API (if key is set) or local Ollama."""
    if GEMINI_API_KEY:
        return await query_gemini_api(prompt, system_prompt, format_json)
    else:
        return await query_ollama(prompt, system_prompt, format_json, temperature)

async def query_ollama(prompt: str, system_prompt: str = "", format_json: bool = False, temperature: float = 0.2) -> str:
    """Queries local Ollama instance with a system prompt and user prompt."""
    await check_ollama_status()
    
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": DEFAULT_MODEL,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "options": {
            "temperature": temperature
        }
    }
    
    if format_json:
        payload["format"] = "json"

    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                raise RuntimeError(f"Ollama returned error status: {response.status_code}")
            
            result = response.json()
            return result.get("response", "")
        except httpx.RequestError as e:
            raise OllamaConnectionError(f"HTTP request to Ollama failed: {str(e)}")

async def analyze_document(text: str) -> dict:
    """
    Performs full analysis of the document (summary, parties, clauses, risks, dates) in a single LLM call.
    """
    sampled_text = text
    if len(text) > 16000:
        sampled_text = text[:11000] + "\n\n... [TRUNCATED FOR BREVITY] ...\n\n" + text[-5000:]
        
    system_prompt = (
        "You are an expert legal counsel and document auditor. Analyze the provided legal document. "
        "Your output must be a single, valid JSON object containing exactly the following keys. "
        "Strictly adhere to the instructions for each key:\n\n"
        
        "1. \"summary\": A string containing a concise executive summary formatted EXACTLY like this template:\n"
        "   \"This [Agreement Type] is between [Disclosing Party] and [Receiving Party] for [Purpose]. The agreement requires the receiving party to maintain confidentiality, prohibits unauthorized disclosure, and includes clauses on intellectual property, liability, governing law, force majeure, and termination. The agreement remains valid for [Agreement duration, e.g. three years], while confidentiality obligations continue for [Confidentiality survival term, e.g. five years] after termination.\"\n"
        "   DO NOT perform addition errors (e.g. do not add 3 years + 5 years to say 8 years after termination. Keep them separate as 3 years validity and 5 years survival).\n\n"
        
        "2. \"confidence_score\": An integer representing your audit confidence level (e.g., 97).\n\n"
        
        "3. \"parties\": A JSON object containing:\n"
        "   - \"disclosing_party\": The legal organization/person disclosing the information (e.g. \"ABC Technologies Pvt. Ltd.\").\n"
        "   - \"receiving_party\": The person/organization receiving the information (e.g. \"John Smith\").\n"
        "   Do not extract job titles (like \"Software Developer\") or defined terms (like \"Confidential Information\") as party names.\n\n"
        
        "4. \"governing_law\": The governing country/state law specified (e.g., \"India\" or \"California\"). Do not return 'Not explicitly specified' if it mentions governing laws or courts anywhere in the text.\n"
        "5. \"jurisdiction\": The specific city/state of the courts or jurisdiction (e.g., \"Ahmedabad, Gujarat\").\n\n"
        
        "6. \"dates\": A list of objects representing important dates, notices, or periods. Extract at least 4 items including: Effective Date, notice periods (e.g., 30-Day Notice), agreement duration (e.g., 3 years), and confidentiality survival period (e.g., 5 years). Each object must have:\n"
        "   - \"event\": Name of the milestone/period (e.g. \"Effective Date\", \"Agreement Duration\", \"Confidentiality Period\", \"Notice Period\").\n"
        "   - \"value\": The specific date, notice time, or period (e.g. \"30-Day Notice\", \"3 Years\", \"5 Years after termination\").\n"
        "   - \"description\": Brief explanation of the terms.\n\n"
        
        "7. \"clauses\": A list of objects representing key clauses. You MUST extract at least 8 to 10 standard clauses (e.g. Purpose, Confidentiality, Obligations, Restrictions, Termination, Intellectual Property, Liability, Governing Law, Force Majeure, Entire Agreement). Each object must have:\n"
        "   - \"category\": The clause type (e.g. \"Confidentiality\", \"Termination\", \"Liability\", \"Governing Law\", \"Intellectual Property\", \"Purpose\", \"Force Majeure\", etc.).\n"
        "   - \"title\": Short title.\n"
        "   - \"description\": Clear explanation.\n"
        "   - \"reference\": A direct quote or section reference from the text.\n"
        "   - \"risk_level\": The risk classification of this clause, MUST be one of: \"Low Risk\", \"Medium Risk\", \"High Risk\", or \"Information\" (use \"Information\" for neutral clauses like Governing Law or Purpose; use \"Medium Risk\" or \"High Risk\" for clauses holding the receiving party liable or specifying survival periods).\n\n"
        
        "8. \"risks\": A list of objects representing potential risks or unfavorable terms for either party (especially the Receiving Party). Audit the document aggressively. Flag at least 2 distinct risks (e.g., Liability/Indemnification for unauthorized disclosure should be flagged as Medium Risk, and Confidentiality obligations continuing long after termination should be flagged as Medium Risk). Each object must have:\n"
        "   - \"level\": Risk level (\"High\", \"Medium\", or \"Low\").\n"
        "   - \"name\": Risk name.\n"
        "   - \"clause\": Direct quote or clause title.\n"
        "   - \"explanation\": Clear explanation of why this poses a risk.\n\n"
        
        "Ensure your response is valid JSON and only contains the raw JSON object. Do not include markdown code block characters like ```json."
    )
    
    prompt = f"Analyze this legal document:\n\n{sampled_text}"
    
    try:
        response_text = await query_llm(prompt, system_prompt, format_json=True, temperature=0.1)
        cleaned = clean_json_response(response_text)
        data = json.loads(cleaned)
        
        return {
            "summary": data.get("summary", "Summary not generated."),
            "confidence_score": data.get("confidence_score", 97),
            "parties": {
                "disclosing_party": data.get("parties", {}).get("disclosing_party", "Not specified"),
                "receiving_party": data.get("parties", {}).get("receiving_party", "Not specified")
            },
            "governing_law": data.get("governing_law", "Not explicitly specified"),
            "jurisdiction": data.get("jurisdiction", "Not specified"),
            "dates": data.get("dates", []),
            "clauses": data.get("clauses", []),
            "risks": data.get("risks", [])
        }
    except Exception as e:
        print(f"Error in combined analysis: {str(e)}")
        raise RuntimeError(f"Failed to analyze document with LLM: {str(e)}")

async def answer_question(query: str, context_chunks: list[dict]) -> str:
    """Answers a question about the document using retrieved chunks as context, citing sources."""
    context_text = ""
    for idx, chunk in enumerate(context_chunks):
        context_text += f"--- Source {idx+1} ---\n{chunk['content']}\n\n"
        
    system_prompt = (
        "You are a helpful and precise AI Legal Assistant. Answer the user's question about the uploaded document "
        "using ONLY the provided relevant context chunks (Sources) from the document. "
        "If the answer cannot be found in the context, say 'I cannot find the answer in the uploaded document.' "
        "Do not make up information or use external knowledge.\n\n"
        "Strictly cite the Source number and quote the section or paragraph name in your answer to increase user trust. "
        "For example:\n"
        "Answer: [Your answer details...]\n\n"
        "Source:\n"
        "- Section: [Section title or content context], Source [Number]"
    )
    
    prompt = f"Relevant Document Context:\n{context_text}\n\nQuestion: {query}\n\nAnswer:"
    return await query_llm(prompt, system_prompt, temperature=0.2)
