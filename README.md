# 🚀 StratifyAI — AI-Powered Startup Consultancy

**StratifyAI** is an intelligent startup assistant built with **React (Vite)** that helps first-time founders structure and grow their startup ideas using AI guidance.  
It features **four domain-specific AI bots** that guide you step-by-step through your startup journey:

| 🤖 Bot | 🎯 Role | 🧠 Focus |
|--------|----------|----------|
| 🧩 **Structure Bot** | Helps with team setup, legal structure, and early operations. |
| 📈 **Marketing Bot** | Designs your go-to-market strategy, audience targeting, and promotion. |
| 💰 **Financial Bot** | Outlines funding strategies, budgets, and revenue models. |
| 🎯 **MVP Bot** | Defines your Minimal Viable Product and validation roadmap. |

Each bot only answers questions from its domain.  
If you ask off-topic or unrelated questions, the system politely **redirects you to the right bot** or blocks irrelevant queries.

---

## 🪶 Features

✅ 4 specialized AI bots for different startup phases  
✅ Cross-bot question detection and redirection  
✅ Blocks non-startup or unrelated questions  
✅ Responsive, modern UI using **lucide-react** icons  
✅ Built-in retry logic for Gemini API rate limits  
✅ Built with **React + Vite** for blazing-fast setup

---

## 📁 Project Structure

Your project directory looks like this:

StratifyAI/
├─ node_modules/
├─ public/
├─ src/
│ ├─ assets/
│ ├─ Pages/
│ │ └─ StartupConsultant.jsx
│ ├─ App.css
│ ├─ App.jsx
│ ├─ index.css
│ └─ main.jsx
├─ .gitignore
├─ eslint.config.js
├─ index.html
├─ package-lock.json
├─ package.json
├─ vite.config.js
└─ README.md

yaml
Copy code

---

## ⚙️ Prerequisites

Before running the project, make sure you have:

- 🟩 **Node.js** ≥ 18  
- 📦 **npm** ≥ 9  
- 🔑 A valid **Google Gemini API key** (Get one from [Google AI Studio](https://aistudio.google.com/))

---

## 🧭 Setup & Run Locally

Follow these simple steps:

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Rafi12234/StratifyAI.git
cd StratifyAI
2️⃣ Install dependencies
bash
Copy code
npm install
3️⃣ Add your Gemini API Key
Open the file:

css
Copy code
src/Pages/StartupConsultant.jsx
Locate the following line (around the top):

js
Copy code
const API_KEY = ""; // 🔑 Paste your Gemini API key here
👉 Replace the empty string with your own Gemini API key (keep it private — do not push it to GitHub).

Example:

js
Copy code
const API_KEY = "YOUR_GEMINI_API_KEY_HERE";
4️⃣ Run the development server
bash
Copy code
npm run dev
Then open your browser at:
👉 http://localhost:5173

💻 Build for Production
To create an optimized production build:

bash
Copy code
npm run build
To preview it locally:

bash
Copy code
npm run preview
🌐 Tech Stack
⚛️ React — Frontend framework

⚡ Vite — Ultra-fast dev bundler

🎨 lucide-react — Beautiful modern icons

🤖 Gemini API — Google’s AI model for idea generation

🔒 Security Notice
🚫 Never commit your real API key to GitHub or share it publicly.
Instead:

Use .env files (add .env to .gitignore)

Reference with import.meta.env.VITE_GEMINI_API_KEY

🧠 Example Workflow
Enter your startup idea (e.g., “An AI tool that generates business names instantly”).

Choose a bot — e.g., Structure Bot.

Ask questions like:

“What team roles should I hire first?”

“How can I structure my company legally?”

The bot responds intelligently.
If your question belongs to another domain (e.g., marketing), it suggests the correct bot.

🧑‍💻 Developer Notes
If icons fail to load, run:

bash
Copy code
npm install lucide-react
The project uses inline CSS for simplicity — feel free to refactor with Tailwind or SCSS.

Tested with Node 20+ and Vite 5+

📜 License
MIT License © 2025 — Built with ❤️ by Shajedul Kabir Rafi
