<<<<<<< HEAD
ResumeAI – Smart Resume Filtering System
📌 Overview

ResumeAI is an AI-powered resume filtering system that helps recruiters and companies quickly shortlist candidates for different job roles.
It supports PDF, DOCX, and TXT resumes, extracts relevant details, and scores them against predefined job descriptions using semantic similarity, skills extraction, keyword matching, and experience analysis.

With a modern Flask backend and an intuitive drag & drop frontend, ResumeAI makes hiring faster, smarter, and more accurate.

✨ Features

✅ AI-Powered Matching – Uses embeddings & semantic similarity to compare resumes with job descriptions.
✅ Multi-format Support – Upload resumes in PDF, DOCX, or TXT.
✅ Role-Based Filtering – Currently supports:

Software Engineer

Data Analyst

Full Stack Developer

Product Manager

etc..
✅ Detailed Scoring – Breakdown of experience, skills, keywords, and overall job match.
✅ Secure & Private – All data is processed locally, no external leaks.
✅ Modern Web UI – Clean drag & drop interface for batch uploads.

🖥️ Tech Stack

Backend: Flask, LangChain, HuggingFace Embeddings, scikit-learn

Frontend: HTML, CSS, JavaScript (Drag & Drop)

Document Parsing: PyMuPDF (PDF), docx2txt & python-docx (DOCX), UTF-8 (TXT)

Vector Store & Embeddings: Sentence Transformers (all-MiniLM-L6-v2)

Hosting: Compatible with GitHub + Hugging Face Spaces + Streamlit Cloud
SMART RESUME SYSTEM
│── app.py                # Main Flask app
│── requirements.txt       # Dependencies
│── README.md              # Project documentation
│── .gitignore             # Ignore venv, cache, etc.
│
├── static/                # Static files
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript
│
├── templates/             # HTML templates
│   └── index.html         # Main UI
│
├── data/                  # Sample resumes (for testing)
└── resume/                # Processed resumes / storage

⚙️ Installation & Setup
1️⃣ Clone Repository
git clone https://github.com/your-username/resumeai.git
cd resumeai

2️⃣ Create Virtual Environment (Recommended)

python -m venv venv
source venv/bin/activate   # On Mac/Linux
venv\Scripts\activate      # On Windows

3️⃣ Install Dependencies

pip install -r requirements.txt

4️⃣ Run the Application

python app.py

The app will run locally at:
👉 http://127.0.0.1:5000

📌 Future Improvements

Export results to Excel / CSV.

👨‍💻 Authors

Author 1:-
Name:-Dinesh kulkarni
Education :-Pursuing  B.Tech in CSE in Data Science (R.V College of Engineering)
gmail:-dineshkulkarni377@gmail.com
Author 2:-
Name :- Shivaraj Dindure
Education :- Pursuing B.tech in Information Science (Dayanand sagar college of engineering)
gmail:-shivarajhdindure@gmail.com
=======
# Automated-Resume-filtering-system
ResumeAI is an AI-powered resume filtering system that helps recruiters and companies quickly shortlist candidates for different job roles. It supports PDF, DOCX, and TXT resumes, extracts relevant details, and scores them against predefined job descriptions using semantic similarity, skills extraction, keyword matching, and experience analysis.
>>>>>>> d98034d5247b51ff352824507657d95244eec18b
