// ResumeAI - Enhanced JavaScript Functionality with Job Role Integration

// Global variables
let currentResults = [];
let currentPage = 1;
let itemsPerPage = 10;
let sortOrder = { column: "score", direction: "desc" };
let currentModalFilename = "";
let selectedJobRole = "";
let uploadedFiles = [];

// Job role configurations for scoring (for frontend display)
const jobRoleConfigs = {
  "software-engineer": { weight: { experience: 0.3, skills: 0.4, keywords: 0.3 } },
  "data-analyst": { weight: { experience: 0.2, skills: 0.5, keywords: 0.3 } },
  "fullstack-developer": { weight: { experience: 0.3, skills: 0.4, keywords: 0.3 } },
  "product-manager": { weight: { experience: 0.4, skills: 0.3, keywords: 0.3 } }
};

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  initializeApplication();
  initializeAnimations();
});

function initializeApplication() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("page") === "results") {
    showPage("results");
    initializeResultsPage();
  } else {
    showPage("upload");
    initializeUploadPage();
  }
}

function showPage(pageName) {
  const uploadPage = document.getElementById("upload-page");
  const resultsPage = document.getElementById("results-page");

  if (pageName === "upload") {
    if (uploadPage) uploadPage.classList.remove("d-none");
    if (resultsPage) resultsPage.classList.add("d-none");
  } else if (pageName === "results") {
    if (uploadPage) uploadPage.classList.add("d-none");
    if (resultsPage) resultsPage.classList.remove("d-none");
    document.getElementById("jobRoleDisplay").textContent = getJobRoleDisplayName(selectedJobRole);
  }
}

// Initialize animations and effects
function initializeAnimations() {
  const animateOnScroll = () => {
    const elements = document.querySelectorAll(".glass-card, .feature-card, .stat-card");
    elements.forEach((el) => {
      const elementTop = el.getBoundingClientRect().top;
      const elementVisible = 150;
      if (elementTop < window.innerHeight - elementVisible) {
        el.classList.add("animate-fade-in");
      }
    });
  };
  window.addEventListener("scroll", animateOnScroll);
  animateOnScroll();
}

// Upload Page Initialization
function initializeUploadPage() {
  const uploadForm = document.getElementById("uploadForm");
  const resumeFiles = document.getElementById("resumeFiles");
  const uploadZone = document.getElementById("uploadZone");
  const fileList = document.getElementById("fileList");
  const jobRoleSelect = document.getElementById("jobRole");
  const processingOptions = document.getElementById("processingOptions");

  if (!uploadForm || !resumeFiles || !uploadZone || !fileList || !jobRoleSelect) {
    showErrorAlert("Could not find all required upload page elements.");
    return;
  }

  jobRoleSelect.addEventListener("change", (e) => {
    selectedJobRole = e.target.value;
    updateSubmitButtonState();
    if (selectedJobRole && processingOptions) {
      processingOptions.style.display = "block";
      processingOptions.classList.add("animate-fade-in");
    }
  });

  uploadZone.addEventListener("click", () => resumeFiles.click());
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });
  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
  });
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });
  resumeFiles.addEventListener("change", (e) => handleFiles(e.target.files));

  function handleFiles(files) {
    const supportedTypes = [
      "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = file.name.split(".").pop().toLowerCase();

      if (supportedTypes.includes(file.type) || ["pdf", "doc", "docx", "txt"].includes(fileExtension)) {
        const existingFile = uploadedFiles.find((f) => f.name === file.name);
        if (existingFile) {
          showErrorAlert(`File "${file.name}" is already uploaded.`);
          continue;
        }

        uploadedFiles.push(file);

        const listItem = document.createElement("li");
        listItem.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
        listItem.dataset.filename = file.name;
        listItem.innerHTML = `
          <div class="d-flex align-items-center">
            <i class="${getFileIcon(fileExtension)} me-2"></i>
            <div>
              <span class="file-item-name">${file.name}</span>
              <small class="text-muted d-block">${formatFileSize(file.size)}</small>
            </div>
          </div>
          <div class="file-item-actions">
            <i class="fas fa-times-circle remove-file-btn"></i>
          </div>
        `;
        fileList.appendChild(listItem);
      } else {
        showErrorAlert(`Unsupported file type: "${file.name}". Please upload PDF, DOC, DOCX, or TXT files.`);
      }
    }
    updateSubmitButtonState();
  }

  function getFileIcon(extension) {
    const icons = { pdf: "fas fa-file-pdf text-danger", doc: "fas fa-file-word text-primary", docx: "fas fa-file-word text-primary", txt: "fas fa-file-alt text-info" };
    return icons[extension] || "fas fa-file";
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  fileList.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-file-btn")) {
      const fileItem = e.target.closest("li");
      if (fileItem) {
        const filename = fileItem.dataset.filename;
        uploadedFiles = uploadedFiles.filter((file) => file.name !== filename);
        fileItem.remove();
        updateSubmitButtonState();
      }
    }
  });

  function updateSubmitButtonState() {
    const submitBtn = document.getElementById("analyzeButton");
    if (submitBtn) {
      const hasFiles = uploadedFiles.length > 0;
      const hasJobRole = selectedJobRole !== "";
      submitBtn.disabled = !(hasFiles && hasJobRole);
      submitBtn.innerHTML = !hasJobRole && !hasFiles ? '<i class="fas fa-paper-plane me-2"></i>Select Role & Upload Files' :
        !hasJobRole ? '<i class="fas fa-briefcase me-2"></i>Select Job Role' :
        !hasFiles ? '<i class="fas fa-upload me-2"></i>Upload Resumes' :
        `<i class="fas fa-paper-plane me-2"></i>Analyze ${uploadedFiles.length} Resume${uploadedFiles.length !== 1 ? "s" : ""}`;
    }
  }

  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (uploadedFiles.length === 0) {
      showErrorAlert("Please upload at least one resume.");
      return;
    }
    if (!selectedJobRole) {
      showErrorAlert("Please select a job role.");
      return;
    }

    await processResumes();
  });

  async function processResumes() {
  const loadingModal = new bootstrap.Modal(document.getElementById("loadingModal"));
  loadingModal.show();

  const formData = new FormData();
  for (let file of uploadedFiles) {
    formData.append("resumes", file);
  }
  formData.append("role", selectedJobRole);

  try {
    const response = await fetch("/api/filter", { method: "POST", body: formData });
    const data = await response.json();
    if (response.ok) {
      currentResults = data.results.map(result => ({
        name: result.Resume.replace(/\.(pdf|doc|docx|txt)$/, ""),
        score: result.Score,
        experienceScore: result.ExperienceScore,
        skillsScore: result.SkillsScore,
        keywordsScore: result.KeywordsScore,
        jobMatch: result.JobMatch,
        yearsExperience: result.YearsExperience,
        skills: result.IdentifiedSkills,
        text: result.ResumeSummary,
        jobRole: selectedJobRole,
        breakdown: { experience: result.ExperienceScore, skills: result.SkillsScore, keywords: result.KeywordsScore }
      }));
      showResultsPreview(currentResults); // Render results first
      // Add a small delay to ensure UI updates before hiding modal
      await new Promise(resolve => setTimeout(resolve, 500));
      loadingModal.hide();
      showSuccessAlert(`${currentResults.length} resumes analyzed successfully for ${getJobRoleDisplayName(selectedJobRole)}!`);
    } else {
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay for error visibility
      loadingModal.hide();
      showErrorAlert(data.error || "Analysis failed");
    }
  } catch (error) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay for error visibility
    loadingModal.hide();
    showErrorAlert("Network error during analysis");
    console.error(error);
  }
}
}

function getJobRoleDisplayName(roleKey) {
  const displayNames = {
    "software-engineer": "Software Engineer", "data-analyst": "Data Analyst",
    "fullstack-developer": "Full Stack Developer", "product-manager": "Product Manager"
  };
  return displayNames[roleKey] || roleKey.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase());
}

function showResultsPreview(results) {
  const resultsPreview = document.getElementById("resultsPreview");
  const resultsStats = document.getElementById("resultsStats");

  if (!resultsPreview || !resultsStats) return;

  const scores = results.map(r => parseFloat(r.score));
  const topScore = Math.max(...scores);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const qualifiedCount = scores.filter(score => score >= 60).length;

  resultsStats.innerHTML = `
    <div class="col-md-3 mb-3">
      <div class="stat-card">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Total Resumes</div>
      </div>
    </div>
    <div class="col-md-3 mb-3">
      <div class="stat-card">
        <div class="stat-value">${topScore.toFixed(1)}</div>
        <div class="stat-label">Top Score</div>
      </div>
    </div>
    <div class="col-md-3 mb-3">
      <div class="stat-card">
        <div class="stat-value">${avgScore.toFixed(1)}</div>
        <div class="stat-label">Average Score</div>
      </div>
    </div>
    <div class="col-md-3 mb-3">
      <div class="stat-card">
        <div class="stat-value">${qualifiedCount}</div>
        <div class="stat-label">Qualified (60+)</div>
      </div>
    </div>
  `;

  resultsPreview.style.display = "block";
  resultsPreview.classList.add("animate-fade-in");
  resultsPreview.scrollIntoView({ behavior: "smooth" });
}

function viewDetailedResults() {
  createResultsPage();
}

function createResultsPage() {
  const app = document.getElementById("app");
  const uploadPage = document.getElementById("upload-page");
  if (uploadPage) uploadPage.style.display = "none";

  const resultsPage = document.createElement("main");
  resultsPage.id = "results-page";
  resultsPage.className = "flex-grow-1 py-4";
  resultsPage.innerHTML = `
    <div class="container">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="result-title">Analysis Results for <span class="text-gradient">${getJobRoleDisplayName(selectedJobRole)}</span></h1>
        <button class="btn btn-secondary-modern" onclick="goBackToUpload()">
          <i class="fas fa-arrow-left me-2"></i>Back to Upload
        </button>
      </div>
      <div class="row mb-5">
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="stat-card">
            <div class="stat-value" id="totalFiles">${currentResults.length}</div>
            <div class="stat-label">Total Resumes</div>
          </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="stat-card">
            <div class="stat-value" id="topScore">${Math.max(...currentResults.map(r => parseFloat(r.score))).toFixed(1)}</div>
            <div class="stat-label">Top Score</div>
          </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="stat-card">
            <div class="stat-value" id="avgScore">${(currentResults.reduce((sum, r) => sum + parseFloat(r.score), 0) / currentResults.length).toFixed(1)}</div>
            <div class="stat-label">Average Score</div>
          </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
          <div class="stat-card">
            <div class="stat-value" id="qualifiedCount">${currentResults.filter(r => parseFloat(r.score) >= 60).length}</div>
            <div class="stat-label">Qualified (60+)</div>
          </div>
        </div>
      </div>
      <div class="modern-table">
        <table class="table table-striped">
          <thead>
            <tr>
              <th class="sortable-header" id="headerName">Candidate Name <i class="fas fa-sort sort-icon"></i></th>
              <th class="sortable-header" id="headerScore">AI Score <i class="fas fa-sort-down sort-icon"></i></th>
              <th class="sortable-header" id="headerExperience">Experience <i class="fas fa-sort sort-icon"></i></th>
              <th>Skills</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="resultsTableBody"></tbody>
        </table>
      </div>
      <nav aria-label="Results pagination" class="mt-4">
        <ul class="pagination justify-content-center" id="pagination"></ul>
      </nav>
    </div>
  `;
  app.appendChild(resultsPage);

  initializeResultsPageFunctionality();
  updateResultsTable();
}

function initializeResultsPageFunctionality() {
  const sortableHeaders = document.querySelectorAll(".sortable-header");
  sortableHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.id.replace("header", "").toLowerCase();
      sortTable(column);
    });
  });
}

function updateResultsTable() {
  renderTable();
  renderPagination();
}

function renderTable() {
  const tableBody = document.getElementById("resultsTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedResults = currentResults.slice(start, end);

  paginatedResults.forEach((resume) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="d-flex align-items-center">
          <i class="fas fa-user-circle me-2 text-gradient"></i>
          <div>
            <div class="fw-semibold">${resume.name}</div>
            <small class="text-muted">${getJobRoleDisplayName(resume.jobRole)}</small>
          </div>
        </div>
      </td>
      <td>
        <span class="badge badge-score" style="background: linear-gradient(135deg, ${getScoreColor(resume.score)}, ${getScoreColor(resume.score, true)})">
          ${resume.score}
        </span>
      </td>
      <td>
        <span class="fw-semibold">${resume.yearsExperience}</span> years
      </td>
      <td>
        <div class="d-flex flex-wrap gap-1">
          ${resume.skills.slice(0, 3).map(skill => `<span class="badge bg-secondary">${skill}</span>`).join("")}
          ${resume.skills.length > 3 ? `<span class="badge bg-info">+${resume.skills.length - 3}</span>` : ""}
        </div>
      </td>
      <td>
        <button type="button" class="btn btn-primary-modern btn-sm" onclick="showCandidateModal('${resume.name}')">
          <i class="fas fa-eye me-1"></i>View Details
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderPagination() {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  pagination.innerHTML = "";
  const pageCount = Math.ceil(currentResults.length / itemsPerPage);

  if (pageCount <= 1) return;

  const prevItem = document.createElement("li");
  prevItem.classList.add("page-item");
  if (currentPage === 1) prevItem.classList.add("disabled");
  prevItem.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i></a>`;
  if (currentPage > 1) {
    prevItem.addEventListener("click", (e) => { e.preventDefault(); currentPage--; updateResultsTable(); });
  }
  pagination.appendChild(prevItem);

  for (let i = 1; i <= pageCount; i++) {
    const pageItem = document.createElement("li");
    pageItem.classList.add("page-item");
    if (i === currentPage) pageItem.classList.add("active");
    pageItem.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
    if (i !== currentPage) {
      pageItem.addEventListener("click", (e) => { e.preventDefault(); currentPage = i; updateResultsTable(); });
    }
    pagination.appendChild(pageItem);
  }

  const nextItem = document.createElement("li");
  nextItem.classList.add("page-item");
  if (currentPage === pageCount) nextItem.classList.add("disabled");
  nextItem.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}"><i class="fas fa-chevron-right"></i></a>`;
  if (currentPage < pageCount) {
    nextItem.addEventListener("click", (e) => { e.preventDefault(); currentPage++; updateResultsTable(); });
  }
  pagination.appendChild(nextItem);
}

function sortTable(column) {
  const newDirection = sortOrder.column === column && sortOrder.direction === "asc" ? "desc" : "asc";
  sortOrder = { column: column, direction: newDirection };

  currentResults.sort((a, b) => {
    let valA, valB;
    switch (column) {
      case "score": valA = parseFloat(a.score); valB = parseFloat(b.score); break;
      case "experience": valA = a.yearsExperience; valB = b.yearsExperience; break;
      case "name": default: valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
    }
    return valA < valB ? (newDirection === "asc" ? -1 : 1) : valA > valB ? (newDirection === "asc" ? 1 : -1) : 0;
  });

  document.querySelectorAll(".sortable-header .sort-icon").forEach((icon) => {
    icon.classList.remove("fa-sort-up", "fa-sort-down");
    icon.classList.add("fa-sort");
  });

  const activeIcon = document.getElementById(`header${column.charAt(0).toUpperCase() + column.slice(1)}`)?.querySelector(".sort-icon");
  if (activeIcon) {
    activeIcon.classList.remove("fa-sort");
    activeIcon.classList.add(newDirection === "asc" ? "fa-sort-up" : "fa-sort-down");
  }

  updateResultsTable();
}

function showCandidateModal(candidateName) {
  const candidate = currentResults.find(r => r.name === candidateName);
  if (!candidate) return;

  currentModalFilename = candidateName;

  let modal = document.getElementById("candidateModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "candidateModal";
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content modern-modal">
          <div class="modal-header">
            <div class="modal-title-section">
              <h5 class="modal-title"><i class="fas fa-user-circle me-2"></i>Candidate Analysis</h5>
              <div class="modal-badge" id="modalScoreBadge"><i class="fas fa-star"></i><span></span></div>
            </div>
            <button type="button" class="modal-close" data-bs-dismiss="modal"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" id="candidateModalBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary-modern" data-bs-dismiss="modal"><i class="fas fa-times me-1"></i>Close</button>
            <button type="button" class="btn btn-primary-modern" onclick="copyCandidateText()"><i class="fas fa-copy me-1"></i>Copy Details</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  populateCandidateModal(candidate);
  new bootstrap.Modal(modal).show();
}

function populateCandidateModal(candidate) {
  const modalBody = document.getElementById("candidateModalBody");
  const modalScoreBadge = document.getElementById("modalScoreBadge").querySelector("span");

  modalScoreBadge.textContent = candidate.score;
  document.getElementById("modalScoreBadge").style.background = `linear-gradient(135deg, ${getScoreColor(candidate.score)}, ${getScoreColor(candidate.score, true)})`;

  modalBody.innerHTML = `
    <div class="row">
      <div class="col-12 mb-4">
        <h6 class="text-light fw-semibold mb-3"><i class="fas fa-user me-2"></i>${candidate.name}</h6>
        <p class="text-muted mb-0">Candidate for ${getJobRoleDisplayName(candidate.jobRole)}</p>
      </div>
      <div class="col-md-4 mb-3">
        <h6 class="text-light">Overall Score:</h6>
        <div class="d-flex align-items-center">
          <span class="badge badge-score me-2" style="background: linear-gradient(135deg, ${getScoreColor(candidate.score)}, ${getScoreColor(candidate.score, true)})">${candidate.score}</span>
          <small class="text-muted">out of 100</small>
        </div>
      </div>
      <div class="col-md-4 mb-3">
        <h6 class="text-light">Experience:</h6>
        <p class="text-muted mb-0">${candidate.yearsExperience} years</p>
      </div>
      <div class="col-md-4 mb-3">
        <h6 class="text-light">Job Match:</h6>
        <p class="text-muted mb-0">${candidate.jobMatch}%</p>
      </div>
      <div class="col-12 mb-4">
        <h6 class="text-light">Score Breakdown:</h6>
        <div class="row">
          <div class="col-md-4">
            <small class="text-muted">Experience Score</small>
            <div class="progress mb-2" style="height: 8px;">
              <div class="progress-bar bg-gradient" style="width: ${candidate.breakdown.experience}%"></div>
            </div>
            <small class="text-light">${candidate.breakdown.experience}/100</small>
          </div>
          <div class="col-md-4">
            <small class="text-muted">Skills Score</small>
            <div class="progress mb-2" style="height: 8px;">
              <div class="progress-bar bg-gradient" style="width: ${candidate.breakdown.skills}%"></div>
            </div>
            <small class="text-light">${candidate.breakdown.skills}/100</small>
          </div>
          <div class="col-md-4">
            <small class="text-muted">Keywords Score</small>
            <div class="progress mb-2" style="height: 8px;">
              <div class="progress-bar bg-gradient" style="width: ${candidate.breakdown.keywords}%"></div>
            </div>
            <small class="text-light">${candidate.breakdown.keywords}/100</small>
          </div>
        </div>
      </div>
      <div class="col-12 mb-3">
        <h6 class="text-light">Identified Skills:</h6>
        <div class="d-flex flex-wrap gap-2">
          ${candidate.skills.map(skill => `<span class="badge bg-secondary">${skill}</span>`).join("")}
        </div>
      </div>
      <div class="col-12">
        <h6 class="text-light">Resume Summary:</h6>
        <div class="bg-glass p-3 rounded">
          <p class="text-muted mb-0">${candidate.text}</p>
        </div>
      </div>
    </div>
  `;
}

function getScoreColor(score, isDark = false) {
  const scoreVal = parseFloat(score);
  return scoreVal >= 90 ? (isDark ? "#11998e" : "#38ef7d") :
         scoreVal >= 75 ? (isDark ? "#4facfe" : "#00f2fe") :
         scoreVal >= 60 ? (isDark ? "#fce38a" : "#f38181") :
         (isDark ? "#fc466b" : "#3f5efb");
}

function goBackToUpload() {
  const resultsPage = document.getElementById("results-page");
  if (resultsPage) resultsPage.remove();
  const uploadPage = document.getElementById("upload-page");
  if (uploadPage) uploadPage.style.display = "block";
  const resultsPreview = document.getElementById("resultsPreview");
  if (resultsPreview) resultsPreview.style.display = "none";
  currentResults = [];
  currentPage = 1;
}

function copyCandidateText() {
  const candidate = currentResults.find(r => r.name === currentModalFilename);
  if (!candidate) return;

  const textToCopy = `
Candidate: ${candidate.name}
Job Role: ${getJobRoleDisplayName(candidate.jobRole)}
Overall Score: ${candidate.score}/100
Job Match: ${candidate.jobMatch}%
Experience: ${candidate.yearsExperience} years
Identified Skills: ${candidate.skills.join(", ")}

Score Breakdown:
- Experience: ${candidate.breakdown.experience}/100
- Skills: ${candidate.breakdown.skills}/100
- Keywords: ${candidate.breakdown.keywords}/100

Summary:
${candidate.text}
  `.trim();

  navigator.clipboard.writeText(textToCopy).then(() => {
    showSuccessAlert("Candidate details copied to clipboard!");
  }).catch(() => {
    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showSuccessAlert("Candidate details copied to clipboard!");
  });
}

function initializeResultsPage() {
  if (currentResults.length === 0) {
    goBackToUpload();
    return;
  }
  initializeResultsPageFunctionality();
  updateResultsTable();
}

function showSuccessAlert(message) { showAlert("success", message); }
function showErrorAlert(message) { showAlert("error", message); }

function showAlert(type, message) {
  const alert = document.getElementById(`${type}Alert`);
  const messageEl = document.getElementById(`${type}Message`);
  if (!alert || !messageEl) return;
  messageEl.textContent = message;
  alert.style.display = "flex";
  alert.style.opacity = "1";
  setTimeout(() => { alert.style.opacity = "0"; setTimeout(() => { alert.style.display = "none"; alert.style.opacity = "1"; }, 300); }, type === "success" ? 3000 : 5000);
}