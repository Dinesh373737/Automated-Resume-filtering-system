import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import logging
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from operator import itemgetter
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from langgraph.graph import StateGraph, END
from typing import TypedDict, Any
import io
import re

# Import libraries with detailed PyMuPDF debugging
try:
    # First, let's see what happens when we try to import fitz
    print("Attempting to import fitz (PyMuPDF)...")
    import sys
    print(f"Python path: {sys.path[:3]}...")  # Show first 3 paths
    
    # Check if PyMuPDF is actually installed
    import pkg_resources
    try:
        pkg_resources.get_distribution('PyMuPDF')
        print("✓ PyMuPDF package is installed")
    except pkg_resources.DistributionNotFound:
        print("✗ PyMuPDF package not found in installed packages")
    
    # Try the actual import with detailed error info
    import fitz
    PDF_AVAILABLE = True
    print("✓ PyMuPDF (fitz) imported successfully")
    print(f"PyMuPDF version: {fitz.version}")
    
except ImportError as e:
    PDF_AVAILABLE = False
    print(f"✗ PyMuPDF import failed: {e}")
    print(f"Error type: {type(e)}")
    
    # Let's try to understand what's going on
    try:
        import importlib.util
        spec = importlib.util.find_spec("fitz")
        if spec is None:
            print("  - 'fitz' module spec not found")
        else:
            print(f"  - 'fitz' module found at: {spec.origin}")
    except Exception as spec_error:
        print(f"  - Could not check module spec: {spec_error}")
    
    # Check for conflicting packages
    try:
        installed_packages = [d.project_name.lower() for d in pkg_resources.working_set]
        conflicting = [pkg for pkg in installed_packages if 'fitz' in pkg and pkg != 'pymupdf']
        if conflicting:
            print(f"  - WARNING: Potentially conflicting packages found: {conflicting}")
    except:
        pass

except Exception as e:
    PDF_AVAILABLE = False
    print(f"✗ Unexpected error importing PyMuPDF: {e}")
    print(f"Error type: {type(e)}")

try:
    import docx2txt
    DOCX_AVAILABLE = True
    print("✓ docx2txt imported successfully")
except ImportError as e:
    DOCX_AVAILABLE = False
    print(f"✗ docx2txt import failed: {e}")

try:
    from docx import Document
    PYTHON_DOCX_AVAILABLE = True
    print("✓ python-docx imported successfully")
except ImportError as e:
    PYTHON_DOCX_AVAILABLE = False
    print(f"✗ python-docx import failed: {e}")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# Initialize embeddings
EMBEDDINGS_AVAILABLE = False
try:
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    EMBEDDINGS_AVAILABLE = True
    print("✓ Embeddings model loaded successfully")
except Exception as e:
    EMBEDDINGS_AVAILABLE = False
    print(f"✗ Embeddings model failed to load: {e}")
    embeddings = None

# Define state schema using TypedDict
class GraphState(TypedDict):
    resume_text: str
    jd_text: str
    score: float
    resume_file: Any
    job_role: str
    detailed_scores: dict

# Parse resume function with better import handling
def parse_resume(state: GraphState) -> GraphState:
    file = state["resume_file"]
    filename = file.filename
    text = ""
    
    logger.info(f"=== PARSING RESUME: {filename} ===")
    logger.info(f"PDF_AVAILABLE: {PDF_AVAILABLE}, DOCX_AVAILABLE: {DOCX_AVAILABLE}")
    
    try:
        # Reset file pointer to beginning
        file.seek(0)
        file_content = file.read()
        file_size = len(file_content)
        
        logger.info(f"File size: {file_size} bytes")
        
        if filename.lower().endswith('.pdf'):
            logger.info("Processing PDF file...")
            if PDF_AVAILABLE:
                try:
                    logger.info(f"Read {len(file_content)} bytes from PDF")
                    doc = fitz.open(stream=file_content, filetype="pdf")
                    logger.info(f"PDF has {doc.page_count} pages")
                    
                    for page_num in range(doc.page_count):
                        page = doc[page_num]
                        page_text = page.get_text()
                        logger.info(f"Page {page_num + 1} text length: {len(page_text)}")
                        text += page_text + " "
                    doc.close()
                except Exception as pdf_error:
                    logger.error(f"PDF processing error: {pdf_error}")
                    text = f"Error processing PDF: {str(pdf_error)}"
            else:
                text = "PDF processing not available - PyMuPDF not installed"
                logger.error("PyMuPDF not available for PDF processing")
                
        elif filename.lower().endswith('.docx'):
            logger.info("Processing DOCX file...")
            if DOCX_AVAILABLE:
                try:
                    # Reset file pointer and use BytesIO for docx2txt
                    file_like = io.BytesIO(file_content)
                    text = docx2txt.process(file_like)
                    logger.info(f"DOCX extracted text length: {len(text) if text else 0}")
                except Exception as docx_error:
                    logger.error(f"DOCX processing error with docx2txt: {docx_error}")
                    # Try alternative method with python-docx
                    if PYTHON_DOCX_AVAILABLE:
                        try:
                            logger.info("Trying python-docx as fallback...")
                            file_like = io.BytesIO(file_content)
                            doc = Document(file_like)
                            text = ""
                            for paragraph in doc.paragraphs:
                                text += paragraph.text + "\n"
                            logger.info(f"Python-docx extracted text length: {len(text)}")
                        except Exception as alt_error:
                            logger.error(f"Python-docx fallback failed: {alt_error}")
                            text = f"Error processing DOCX: {str(docx_error)}"
                    else:
                        text = f"Error processing DOCX: {str(docx_error)}"
            else:
                text = "DOCX processing not available - docx2txt not installed"
                logger.error("docx2txt not available for DOCX processing")
                
        elif filename.lower().endswith('.txt'):
            logger.info("Processing TXT file...")
            try:
                text = file_content.decode('utf-8')
                logger.info(f"TXT file text length: {len(text)}")
            except UnicodeDecodeError:
                # Try different encodings
                for encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                    try:
                        text = file_content.decode(encoding)
                        logger.info(f"TXT file decoded with {encoding}, length: {len(text)}")
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    text = "Error: Could not decode text file"
                    logger.error("Could not decode text file with any encoding")
            except Exception as txt_error:
                logger.error(f"TXT processing error: {txt_error}")
                text = f"Error processing TXT: {str(txt_error)}"
        else:
            logger.warning(f"Unsupported file format: {filename}")
            text = f"Unsupported file format: {filename.split('.')[-1] if '.' in filename else 'unknown'}"
            
        # Clean and validate text
        if text:
            text = text.strip()
            # Remove excessive whitespace but preserve some structure
            text = ' '.join(text.split())
            
        logger.info(f"Final extracted text length: {len(text)}")
        logger.info(f"Text preview (first 300 chars): '{text[:300]}'")
        
        # More lenient validation
        if len(text) < 5:
            logger.warning(f"Very short text extracted from {filename}")
            if not text or text.startswith("Error"):
                text = f"Minimal content from {filename}"
            
        state["resume_text"] = text
        logger.info(f"=== PARSING COMPLETE for {filename} ===")
        
    except Exception as e:
        logger.error(f"Parsing error for {filename}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        state["resume_text"] = f"Error parsing {filename}: {str(e)}"
        
    return state

# Load JD function with more comprehensive job descriptions
def load_jd(state: GraphState) -> GraphState:
    job_role = state.get("job_role", "software-engineer")
    
    jds = {
        "software-engineer": """
        We are looking for an experienced Software Engineer with strong programming skills.
        Required skills: Python, Java, JavaScript, React, Node.js, SQL, Git, Agile methodologies.
        Experience with cloud platforms (AWS, Azure), containerization (Docker), and CI/CD pipelines preferred.
        Strong problem-solving skills and ability to work in a collaborative team environment.
        Bachelor's degree in Computer Science or related field with 3+ years of experience.
        """,
        "data-analyst": """
        We are seeking a skilled Data Analyst to join our analytics team.
        Required skills: SQL, Python, R, Excel, Tableau, Power BI, statistical analysis.
        Experience with data visualization, data mining, and business intelligence tools.
        Knowledge of machine learning concepts and experience with pandas, numpy, matplotlib.
        Strong analytical thinking and ability to derive insights from complex datasets.
        Bachelor's degree in Statistics, Mathematics, or related field with 2+ years of experience.
        """,
        "fullstack-developer": """
        We are hiring a Full Stack Developer to build end-to-end web applications.
        Required skills: JavaScript, React, Node.js, Python, HTML, CSS, MongoDB, PostgreSQL.
        Experience with RESTful APIs, Git version control, Docker, and cloud deployment.
        Knowledge of modern frameworks, responsive design, and agile development practices.
        Bachelor's degree in Computer Science with 2+ years of full-stack development experience.
        """,
        "product-manager": """
        We are looking for a Product Manager to drive product strategy and development.
        Required skills: Product roadmap planning, user research, market analysis, Agile/Scrum.
        Experience with product analytics tools, A/B testing, and customer feedback analysis.
        Strong communication skills and ability to work cross-functionally with engineering and design teams.
        Knowledge of user experience principles and product lifecycle management.
        MBA or Bachelor's degree with 4+ years of product management experience.
        """
    }
    
    state["jd_text"] = jds.get(job_role, jds["software-engineer"])
    logger.info(f"Loaded job description for role: {job_role}")
    return state

# Enhanced scoring function with detailed breakdown
def compute_detailed_scores(resume_text: str, jd_text: str, job_role: str = "software-engineer") -> dict:
    """Compute detailed scoring breakdown for resume analysis"""
    
    logger.info(f"=== COMPUTING DETAILED SCORES ===")
    logger.info(f"EMBEDDINGS_AVAILABLE: {EMBEDDINGS_AVAILABLE}")
    
    # Initialize scores
    scores = {
        "overall_score": 0.0,
        "experience_score": 0,
        "skills_score": 0,
        "keywords_score": 0,
        "job_match": 0.0,
        "years_experience": 0,
        "identified_skills": [],
        "resume_summary": resume_text[:200] + "..." if len(resume_text) > 200 else resume_text
    }
    
    try:
        # 1. SEMANTIC SIMILARITY (Overall Score)
        if EMBEDDINGS_AVAILABLE:
            logger.info("Computing semantic similarity...")
            resume_embed = embeddings.embed_documents([resume_text])[0]
            jd_embed = embeddings.embed_documents([jd_text])[0]
            
            logger.info(f"Embeddings generated successfully")
            
            resume_vector = np.array(resume_embed)
            jd_vector = np.array(jd_embed)
            
            logger.info(f"Vector norms: resume={np.linalg.norm(resume_vector):.6f}, jd={np.linalg.norm(jd_vector):.6f}")
            
            if np.linalg.norm(resume_vector) > 0 and np.linalg.norm(jd_vector) > 0:
                similarity = cosine_similarity([resume_vector], [jd_vector])[0][0]
                logger.info(f"Computed similarity: {similarity:.6f}")
                if np.isfinite(similarity):
                    scores["overall_score"] = max(0.0, similarity * 100)
                    scores["job_match"] = max(0.0, similarity * 100)
                    logger.info(f"Final overall score: {scores['overall_score']:.2f}")
        else:
            logger.warning("Embeddings not available - using fallback scoring")
        
        # 2. EXPERIENCE EXTRACTION AND SCORING
        experience_keywords = [
            "years", "year", "experience", "experienced", "exp", "months", "month",
            "internship", "intern", "work", "worked", "employment", "job", "position"
        ]
        
        resume_lower = resume_text.lower()
        
        # Extract years of experience
        year_patterns = [
            r'(\d+)\s*\+?\s*years?\s+(?:of\s+)?experience',
            r'(\d+)\s*years?\s+experience',
            r'experience\s*:?\s*(\d+)\s*years?',
            r'(\d+)\s*years?\s+in',
            r'(\d+)\s*yr\s+',
            r'(\d+)\s*-\s*(\d+)\s*years?'
        ]
        
        years_found = []
        for pattern in year_patterns:
            matches = re.findall(pattern, resume_lower)
            for match in matches:
                if isinstance(match, tuple):
                    years_found.extend([int(x) for x in match if x.isdigit()])
                elif match.isdigit():
                    years_found.append(int(match))
        
        if years_found:
            scores["years_experience"] = max(years_found)
            # Score based on experience (0-100 scale, assuming 10+ years = 100)
            scores["experience_score"] = min(100, (scores["years_experience"] / 10) * 100)
        else:
            # Check for experience indicators without explicit years
            exp_indicators = sum(1 for keyword in experience_keywords if keyword in resume_lower)
            scores["experience_score"] = min(100, exp_indicators * 10)
            scores["years_experience"] = max(1, exp_indicators // 2)  # Rough estimate
        
        # 3. SKILLS SCORING
        # Define skill sets for different roles
        all_skills = {
            "data-analyst": [
                "python", "sql", "r", "excel", "tableau", "power bi", "pandas", "numpy",
                "matplotlib", "seaborn", "statistics", "analytics", "data visualization",
                "machine learning", "data mining", "business intelligence", "reporting",
                "dashboard", "etl", "database", "statistical analysis"
            ],
            "software-engineer": [
                "python", "java", "javascript", "react", "node.js", "sql", "git",
                "html", "css", "docker", "kubernetes", "aws", "azure", "mongodb",
                "postgresql", "rest api", "microservices", "agile", "scrum", "ci/cd"
            ],
            "fullstack-developer": [
                "javascript", "react", "node.js", "python", "html", "css", "mongodb", 
                "postgresql", "git", "docker", "rest api", "express", "vue", "angular",
                "bootstrap", "responsive design", "api", "database", "frontend", "backend"
            ],
            "product-manager": [
                "product management", "roadmap", "agile", "scrum", "user research",
                "market analysis", "a/b testing", "analytics", "stakeholder management",
                "product strategy", "user experience", "wireframing", "requirements",
                "project management", "leadership", "communication"
            ]
        }
        
        # Get skills for the specific role
        relevant_skills = all_skills.get(job_role, all_skills["software-engineer"])
        
        # Count skills found in resume
        found_skills = []
        for skill in relevant_skills:
            if skill.lower() in resume_lower:
                found_skills.append(skill)
        
        scores["identified_skills"] = found_skills
        # Skills score: percentage of required skills found
        scores["skills_score"] = min(100, int((len(found_skills) / len(relevant_skills)) * 100))
        
        # 4. KEYWORDS SCORING
        # Extract important keywords from job description
        jd_keywords = []
        jd_words = jd_text.lower().split()
        
        # Filter out common words and extract meaningful keywords
        common_words = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "be", "been", "have", "has", "had", "will", "would", "could", "should", "may", "might", "can", "must"}
        
        for word in jd_words:
            cleaned_word = re.sub(r'[^\w]', '', word)
            if len(cleaned_word) > 3 and cleaned_word not in common_words:
                jd_keywords.append(cleaned_word)
        
        # Remove duplicates and get top keywords
        jd_keywords = list(set(jd_keywords))[:20]  # Top 20 keywords
        
        # Count keyword matches
        keyword_matches = sum(1 for keyword in jd_keywords if keyword in resume_lower)
        scores["keywords_score"] = min(100, int((keyword_matches / len(jd_keywords)) * 100)) if jd_keywords else 0
        
        # Ensure all scores are integers where expected
        scores["experience_score"] = int(round(scores["experience_score"]))
        scores["years_experience"] = int(scores["years_experience"])
        
        logger.info(f"Detailed scores: {scores}")
        
        return scores
        
    except Exception as e:
        logger.error(f"Error computing detailed scores: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return scores

# Simple wrapper for chain compatibility
def simple_compute_score(input_data):
    """Simple wrapper for chain compatibility"""
    resume_text = input_data.get("resume", "")
    jd_text = input_data.get("jd", "")
    detailed = compute_detailed_scores(resume_text, jd_text)
    return {"score": detailed["overall_score"]}

# Build the chain
chain = (
    {"resume": itemgetter("resume"), "jd": itemgetter("jd")}
    | RunnableLambda(simple_compute_score)
)

# Semantic match node - now with detailed scoring
def semantic_match(state: GraphState) -> GraphState:
    try:
        resume_text = state["resume_text"]
        jd_text = state["jd_text"]
        job_role = state.get("job_role", "software-engineer")
        
        logger.info(f"Computing detailed scores for resume length: {len(resume_text)}, JD length: {len(jd_text)}")
        
        # Compute detailed scores
        detailed_scores = compute_detailed_scores(resume_text, jd_text, job_role)
        
        # Set the main score for backward compatibility
        state["score"] = detailed_scores["overall_score"]
        
        # Store detailed scores in state
        state["detailed_scores"] = detailed_scores
        
        # Get filename safely
        filename = "unknown"
        try:
            if hasattr(state.get("resume_file"), "filename"):
                filename = state["resume_file"].filename
        except:
            pass
            
        logger.info(f"Final detailed scores for {filename}: Overall={detailed_scores['overall_score']:.2f}, Experience={detailed_scores['experience_score']}, Skills={detailed_scores['skills_score']}, Keywords={detailed_scores['keywords_score']}")
        
    except Exception as e:
        logger.error(f"Semantic matching error: {str(e)}")
        import traceback
        logger.error(f"Semantic matching traceback: {traceback.format_exc()}")
        state["score"] = 0.0
        state["detailed_scores"] = {
            "overall_score": 0.0,
            "experience_score": 0,
            "skills_score": 0,
            "keywords_score": 0,
            "job_match": 0.0,
            "years_experience": 0,
            "identified_skills": [],
            "resume_summary": "Error processing resume"
        }
        
    return state

# Build and compile the graph with StateGraph
graph = StateGraph(GraphState)
graph.add_node("parse_resume", parse_resume)
graph.add_node("load_jd", load_jd)
graph.add_node("semantic_match", semantic_match)
graph.set_entry_point("parse_resume")
graph.add_edge("parse_resume", "load_jd")
graph.add_edge("load_jd", "semantic_match")
graph.add_edge("semantic_match", END)
app_graph = graph.compile()

# Flask route for file upload and analysis with better error handling
@app.route('/api/filter', methods=['POST'])
def filter_resumes():
    try:
        logger.info("Received filter request")
        
        # Validate request
        if 'resumes' not in request.files:
            return jsonify({"error": "No resumes uploaded"}), 400
        
        if 'role' not in request.form:
            return jsonify({"error": "No role specified"}), 400

        files = request.files.getlist('resumes')
        job_role = request.form['role']
        
        logger.info(f"Processing {len(files)} files for role: {job_role}")
        
        if not files or all(f.filename == '' for f in files):
            return jsonify({"error": "No files selected"}), 400
        
        results = []
        
        for i, file in enumerate(files):
            try:
                logger.info(f"Processing file {i+1}/{len(files)}: {file.filename}")
                
                # Create initial state with detailed scores
                state = GraphState(
                    resume_text="", 
                    jd_text="", 
                    score=0.0, 
                    resume_file=file, 
                    job_role=job_role,
                    detailed_scores={}
                )
                
                # Process through the graph
                final_state = app_graph.invoke(state)
                
                # Extract and validate results
                score = final_state.get("score", 0.0)
                resume_text = final_state.get("resume_text", "")
                detailed_scores = final_state.get("detailed_scores", {})
                
                logger.info(f"Final state for {file.filename}: score={score}, text_length={len(resume_text)}")
                
                # Ensure score is valid
                if not isinstance(score, (int, float)) or np.isnan(score) or np.isinf(score):
                    logger.warning(f"Invalid final score for {file.filename}: {score}")
                    score = 0.0
                
                # Prepare enhanced result with detailed breakdown
                result = {
                    "Resume": file.filename,
                    "Score": round(float(score), 2),
                    "Text": (resume_text[:200] + "...") if len(resume_text) > 200 else resume_text,
                    "Status": "Success" if resume_text and resume_text != "Error parsing file" else "Error",
                    
                    # Detailed scoring breakdown for frontend
                    "ExperienceScore": detailed_scores.get("experience_score", 0),
                    "SkillsScore": detailed_scores.get("skills_score", 0),
                    "KeywordsScore": detailed_scores.get("keywords_score", 0),
                    "JobMatch": round(detailed_scores.get("job_match", 0.0), 1),
                    "YearsExperience": detailed_scores.get("years_experience", 0),
                    "IdentifiedSkills": detailed_scores.get("identified_skills", []),
                    "ResumeSummary": detailed_scores.get("resume_summary", resume_text[:200] + "..." if resume_text else "")
                }
                
                results.append(result)
                logger.info(f"Processed {file.filename} with score: {result['Score']}")
                
            except Exception as file_error:
                logger.error(f"Error processing {file.filename}: {str(file_error)}")
                results.append({
                    "Resume": file.filename,
                    "Score": 0.0,
                    "Text": "Error processing file",
                    "Status": "Error",
                    "ExperienceScore": 0,
                    "SkillsScore": 0,
                    "KeywordsScore": 0,
                    "JobMatch": 0.0,
                    "YearsExperience": 0,
                    "IdentifiedSkills": [],
                    "ResumeSummary": "Error processing file"
                })
        
        # Sort results by score in descending order
        results.sort(key=lambda x: x["Score"], reverse=True)
        
        logger.info(f"Successfully processed {len(results)} files")
        return jsonify({"results": results, "total": len(results)}), 200
        
    except Exception as e:
        logger.error(f"API error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# Route for the main page
@app.route('/')
def index():
    return render_template('index.html')

# Health check endpoint
@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy", "message": "Resume filtering service is running"}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=7860)
