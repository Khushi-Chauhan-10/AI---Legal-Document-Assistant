# AI Legal Document Assistant

An enterprise-ready, high-performance web application designed to automate the ingestion, analysis, and risk auditing of legal agreements (NDAs, rental deeds, service level contracts). The project operates a Retrieval-Augmented Generation (RAG) pipeline to ground all chatbot answers in the document's text and prevent hallucinations.

---

## 🏗️ Architecture Options

The application supports two execution modes:

### 1. 🔒 Local-First Mode (100% Private)
* **LLM Engine**: Local Llama 3.2 (3B Parameters) run via **Ollama**.
* **Vector Index**: Local FAISS index utilizing Sentence Transformers (`all-MiniLM-L6-v2`).
* **Ideal For**: Local testing, offline use, and maximum security compliance where no text can leave the local machine.

### 2. ☁️ Cloud-Ready Mode (Scale/Share)
* **LLM Engine**: Google **Gemini 1.5 Flash** (via API).
* **Vector Index**: Local FAISS index cached in disk storage.
* **Ideal For**: Deploying public links (e.g. Netlify + Render) for remote users without requiring local GPU hardware. Activated simply by setting the `GEMINI_API_KEY` environment variable.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
* Python 3.10+
* Node.js 18+
* [Ollama](https://ollama.com/) (installed and running `ollama run llama3.2`)

### Automated Local Execution (Windows)
Double-click the launcher scripts in the root folder:
* **`run_project.bat`**: Automatically checks Ollama, starts the FastAPI backend, starts the React dev server, and opens your browser to `http://localhost:3000`.
* **`share_with_friend.bat`**: Fetches your public IP (security password) and generates a secure public HTTPS link using `localtunnel` so anyone on the internet can test your local server.

---

## 🐳 Docker Deployment (Enterprise Standard)

You can containerize and run the entire application using Docker:

### 1. Build and Run Container Orchestration
Ensure Docker Desktop is open, and run:
```bash
docker-compose up --build
```

* **Frontend Dashboard**: Accessible at [http://localhost:3000](http://localhost:3000)
* **FastAPI Swagger Docs**: Accessible at [http://localhost:8000/docs](http://localhost:8000/docs)

*Note: If running Docker on the cloud, set the `GEMINI_API_KEY` env variable so it defaults to Google's fast cloud inference.*

---

## ☁️ Permanent Cloud Deployment (Netlify + Render)

To share a working link that stays online 24/7 even when your laptop is closed, follow this guide:

### Step 1: Obtain a Free Google Gemini API Key
1. Go to the [Google AI Studio](https://aistudio.google.com/).
2. Create and copy a free API key.

### Step 2: Deploy the FastAPI Backend to Render.com (Free)
1. Sign up/Log in on [Render](https://render.com/).
2. Click **New +** -> **Web Service**.
3. Link your GitHub repository or use Render's command-line deployment.
4. Set the following configuration options:
   * **Language**: `Python 3` (or choose `Docker` since a `Dockerfile` is provided).
   * **Build Command**: `pip install -r requirements.txt && python -m spacy download en_core_web_sm` (If choosing Python environment).
   * **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT` (If choosing Python environment).
5. In the **Environment Variables** tab, add:
   * `GEMINI_API_KEY` = `[Your Gemini API Key]`
6. Click **Deploy**. Note the generated backend URL (e.g. `https://legal-assistant-api.onrender.com`).

### Step 3: Deploy the React Frontend to Netlify (Free)
1. Sign up/Log in on [Netlify](https://www.netlify.com/).
2. Click **Add new site** -> **Import from Git** (or drag & drop the compiled `dist/` folder).
3. If importing from Git, set these settings:
   * **Build Command**: `npm run build`
   * **Publish Directory**: `dist`
4. **CRITICAL STEP**: Under **Build & deploy** -> **Environment**, add this variable:
   * `VITE_API_URL` = `https://[your-render-backend-subdomain].onrender.com` (Your Render backend URL).
5. Click **Deploy Site**.
6. Open your Netlify site URL! The app is now live, connected to your cloud backend, and fully functional on the internet.

---

## 📂 Project Structure

```
├── backend/
│   ├── main.py              # FastAPI server routes
│   ├── llm_client.py        # Single-call LLM analysis & Gemini/Ollama handlers
│   ├── document_parser.py   # PyMuPDF and python-docx extractor
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Backend container build instructions
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main dashboard & uploader
│   │   ├── index.css        # Tailwind styling & 3D perspective animations
│   │   └── components/
│   │       └── DocumentAnalyzer.jsx  # Audit widgets & Q&A chatbot
│   ├── nginx.conf           # SPA server configuration
│   └── Dockerfile           # Frontend static build container
├── run_project.bat          # Automated local startup
├── share_with_friend.bat    # Automated internet-sharing tunnel script
└── docker-compose.yml       # Production multi-container orchestrator
```
