# Academic DOI Extractor & Downloader Assistant

A professional, full-stack research tool designed for PhD students, researchers, and academics to streamline the literature review process. Extract DOIs from manuscripts, identify article titles with high precision, and download full texts directly via Sci-Hub.

![Research Tool](https://picsum.photos/seed/research/1200/400)

## 🚀 Key Features

- **Algorithmic DOI Extraction**: Fast, local extraction of DOI patterns from any text-based PDF.
- **Improved Title Recognition**: Advanced heuristics to identify actual paper titles instead of cryptic citation fragments.
- **Smart Metadata Shield (Pro)**: High-precision metadata refinement using **Gemini 3 Flash** and official academic registers (OpenAlex/Crossref).
- **Direct Sci-Hub Integration**: One-click downloads for discovered DOIs.
- **Reference Management**: Instant export to BibTeX (Zotero) and RIS (Mendeley/EndNote).
- **Research Dashboard**: Export your analysis as a portable HTML binder.
- **Responsive SaaS UI**: Polished interface built with React, Tailwind CSS, and Framer Motion.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express.js.
- **PDF Engine**: PDF.js (Client-side).
- **AI Engine**: Gemini 3 Flash (State-of-the-art academic extraction).

## ⚙️ Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Google Gemini API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/academic-doi-extractor.git
   cd academic-doi-extractor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

5. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

## 🛡️ Security & Privacy

- **Standard Scan**: 100% private. All processing happens in your browser. No data is sent to our servers.
- **AI Scan**: Only the extracted reference text is sent to our secure server for metadata refinement. No PDF files are stored.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built for academics, by researchers.
