let quizData = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let quizTitle = '';
let participantName = '';
const QUESTION_TIME_LIMIT = 60;
let questionTimerId = null;
let questionTimeLeft = QUESTION_TIME_LIMIT;
const PARTICIPANT_KEY = 'quiz_participant_v1';
const RESULT_KEY = 'quiz_results_v1';
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbydoPhCyZ6hQ49olUPapXGc9YoSyQzXKF5WOwhI24yFMYPrcxQQUb1pCEv9D6iOcz6Tqw/exec';

function shuffleQuestions(items) {
    const shuffled = [...items];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

// โหลดข้อสอบจากไฟล์ JSON โดยตรง
async function loadQuiz() {
    showLoading(true);

    try {
        const response = await fetch('quiz_data.json');
        const data = await response.json();

        console.log('Data from file:', data); // Debug

        // รองรับทั้งรูปแบบ {questions: [...]} และ [...] โดยตรง
        if (Array.isArray(data)) {
            quizData = shuffleQuestions(data);
            quizTitle = '📝 แบบทดสอบ';
        } else if (data.questions && Array.isArray(data.questions)) {
            quizData = shuffleQuestions(data.questions);
            quizTitle = '📝 ' + (data.quizTitle || 'แบบทดสอบ');
        } else {
            throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
        }

        userAnswers = new Array(quizData.length).fill(null);
        currentQuestionIndex = 0;

        showSection('quiz-section');
        displayQuestion();
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            title: 'เกิดข้อผิดพลาด',
            text: 'เกิดข้อผิดพลาดในการโหลดข้อสอบ: ' + error.message,
            icon: 'error',
            confirmButtonText: 'ตกลง'
        });
    } finally {
        showLoading(false);
    }
}

// แสดงคำถามปัจจุบัน
function displayQuestion() {
    const question = quizData[currentQuestionIndex];

    stopQuestionTimer();
    questionTimeLeft = QUESTION_TIME_LIMIT;

    document.getElementById('quiz-title').textContent = quizTitle;
    document.getElementById('question-text').textContent = question.question;
    document.getElementById('current-question').textContent = currentQuestionIndex + 1;
    document.getElementById('total-questions').textContent = quizData.length;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    question.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.onclick = () => selectOption(index);
        
        if (userAnswers[currentQuestionIndex] === index) {
            optionElement.classList.add('selected');
        }
        
        optionsContainer.appendChild(optionElement);
    });

    // อัปเดตปุ่ม
    document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;

    if (currentQuestionIndex === quizData.length - 1) {
        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('submit-btn').classList.remove('hidden');
    } else {
        document.getElementById('next-btn').classList.remove('hidden');
        document.getElementById('submit-btn').classList.add('hidden');
    }

    updateTimerDisplay();
    startQuestionTimer();
}

function updateTimerDisplay() {
    const minutes = String(Math.floor(questionTimeLeft / 60)).padStart(2, '0');
    const seconds = String(questionTimeLeft % 60).padStart(2, '0');
    document.getElementById('question-timer').textContent = `${minutes}:${seconds}`;
}

function startQuestionTimer() {
    stopQuestionTimer();
    questionTimerId = setInterval(() => {
        questionTimeLeft -= 1;
        updateTimerDisplay();

        if (questionTimeLeft <= 0) {
            stopQuestionTimer();
            autoAdvanceQuestion();
        }
    }, 1000);
}

function stopQuestionTimer() {
    if (questionTimerId) {
        clearInterval(questionTimerId);
        questionTimerId = null;
    }
}

function autoAdvanceQuestion() {
    if (currentQuestionIndex === quizData.length - 1) {
        submitQuiz();
    } else {
        nextQuestion();
    }
}

// เลือกตัวเลือก
function selectOption(optionIndex) {
    userAnswers[currentQuestionIndex] = optionIndex;
    
    const options = document.querySelectorAll('.option');
    options.forEach((option, index) => {
        option.classList.remove('selected');
        if (index === optionIndex) {
            option.classList.add('selected');
        }
    });
}

// คำถามถัดไป
function nextQuestion() {
    if (currentQuestionIndex < quizData.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    }
}

// คำถามก่อนหน้า
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

// ส่งคำตอบ
function submitQuiz() {
    stopQuestionTimer();

    // ตรวจสอบว่าตอบครบทุกข้อหรือยัง
    const unanswered = userAnswers.filter(answer => answer === null).length;
    if (unanswered > 0) {
        Swal.fire({
            title: 'ยังไม่ได้ตอบครบ',
            text: `คุณยังไม่ได้ตอบ ${unanswered} ข้อ ต้องการส่งคำตอบหรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'ส่งคำตอบ',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                calculateScore();
            }
        });
        return;
    }

    calculateScore();
}

function calculateScore() {
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    quizData.forEach((question, index) => {
        const correctAnswer = question.correctAnswer !== undefined ? question.correctAnswer : question.answer;
        const userAnswer = userAnswers[index];

        if (userAnswer === null) {
            unansweredCount++;
        } else if (userAnswer === correctAnswer) {
            score++;
            correctCount++;
        } else {
            incorrectCount++;
        }
    });

    const percentage = Math.round((score / quizData.length) * 100);

    document.getElementById('score').textContent = score;
    document.getElementById('total-score').textContent = quizData.length;
    document.getElementById('score-percentage').textContent = percentage + '%';
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('incorrect-count').textContent = incorrectCount;
    document.getElementById('unanswered-count').textContent = unansweredCount;

    let message = '';
    if (percentage >= 80) {
        message = 'ยอดเยี่ยม! คุณทำได้ดีมาก 🎉';
    } else if (percentage >= 60) {
        message = 'ดีมาก! คุณผ่านเกณฑ์ 👍';
    } else if (percentage >= 40) {
        message = 'พอใช้ ลองทบทวนอีกครั้งนะ 📚';
    } else {
        message = 'ควรทบทวนเนื้อหาอีกครั้ง 💪';
    }

    const summary = `คุณได้ตอบถูก ${correctCount} ข้อ จาก ${quizData.length} ข้อ • ตอบผิด ${incorrectCount} ข้อ • ยังไม่ได้ตอบ ${unansweredCount} ข้อ`;

    document.getElementById('score-message').textContent = message;
    document.getElementById('result-summary').textContent = summary;
    document.getElementById('participant-summary').textContent = `ผู้เข้าทำ: ${participantName}`;

    const resultPayload = {
        name: participantName,
        score,
        total: quizData.length,
        percentage,
        correctCount,
        incorrectCount,
        unansweredCount,
        submittedAt: new Date().toISOString()
    };

    saveResultToLocalStorage(resultPayload);
    sendResultToGoogleSheet(resultPayload);
    showSection('result-section');
}

// แสดงเฉลย
function showAnswers() {
    const reviewContainer = document.getElementById('review-container');
    reviewContainer.innerHTML = '';

    quizData.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const correctAnswer = question.correctAnswer !== undefined ? question.correctAnswer : question.answer;

        let status = '';
        let statusClass = '';

        if (userAnswer === null) {
            status = 'ไม่ได้ตอบ';
            statusClass = 'unanswered';
        } else if (userAnswer === correctAnswer) {
            status = 'ตอบถูก';
            statusClass = 'correct';
        } else {
            status = 'ตอบผิด';
            statusClass = 'incorrect';
        }

        const reviewItem = document.createElement('div');
        reviewItem.className = `review-item ${statusClass}`;

        let optionsHtml = '';
        question.options.forEach((option, optIndex) => {
            let optionClass = '';
            if (optIndex === correctAnswer) {
                optionClass = 'correct';
            } else if (optIndex === userAnswer && userAnswer !== correctAnswer) {
                optionClass = 'wrong';
            } else if (optIndex === userAnswer) {
                optionClass = 'selected';
            }

            const prefix = optIndex === correctAnswer ? '✓ ' : (optIndex === userAnswer ? '✗ ' : '');
            optionsHtml += `<div class="review-option ${optionClass}">${prefix}${option}</div>`;
        });

        reviewItem.innerHTML = `
            <div class="review-question">ข้อที่ ${index + 1}: ${question.question}</div>
            <div class="review-options">${optionsHtml}</div>
            <div class="review-answer ${statusClass}">${status} - คำตอบที่ถูก: ${question.options[correctAnswer]}</div>
        `;

        reviewContainer.appendChild(reviewItem);
    });

    showSection('review-section');
}

function addKeyboardNavigation() {
    document.addEventListener('keydown', (event) => {
        if (!quizData.length) {
            return;
        }

        const activeSection = document.querySelector('.section.active');
        if (!activeSection || activeSection.id !== 'quiz-section') {
            return;
        }

        if (event.key === 'ArrowRight') {
            nextQuestion();
        } else if (event.key === 'ArrowLeft') {
            previousQuestion();
        }
    });
}

// กลับไปหน้าผลลัพธ์
function backToResult() {
    showSection('result-section');
}

// เริ่มทำข้อสอบใหม่
function restartQuiz() {
    stopQuestionTimer();
    userAnswers = new Array(quizData.length).fill(null);
    currentQuestionIndex = 0;
    showSection('quiz-section');
    displayQuestion();
}

function saveParticipantToLocalStorage() {
    try {
        localStorage.setItem(PARTICIPANT_KEY, JSON.stringify({
            name: participantName
        }));
    } catch (error) {
        console.warn('Unable to save participant data:', error);
    }
}

function saveResultToLocalStorage(resultPayload) {
    try {
        const existingResults = JSON.parse(localStorage.getItem(RESULT_KEY) || '[]');
        existingResults.push(resultPayload);
        localStorage.setItem(RESULT_KEY, JSON.stringify(existingResults));
    } catch (error) {
        console.warn('Unable to save quiz result:', error);
    }
}

async function sendResultToGoogleSheet(resultPayload) {
    try {
        const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resultPayload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('Unable to send result to Google Sheet:', error);
    }
}

// แสดงส่วนต่างๆ ของหน้าเว็บ
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    
    const targetSection = document.getElementById(sectionId);
    targetSection.classList.remove('hidden');
    targetSection.classList.add('active');
}

// แสดง/ซ่อน loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
        loading.classList.add('active');
    } else {
        loading.classList.add('hidden');
        loading.classList.remove('active');
    }
}

// เริ่มทำแบบทดสอบ
function startQuiz() {
    participantName = document.getElementById('participant-name').value.trim();

    if (!participantName) {
        Swal.fire({
            title: 'กรุณากรอกข้อมูลผู้เข้าทำ',
            text: 'โปรดระบุชื่อ-นามสกุลก่อนเริ่มทำแบบทดสอบ',
            icon: 'warning',
            confirmButtonText: 'ตกลง'
        });
        return;
    }

    saveParticipantToLocalStorage();
    showSection('loading');
    loadQuiz();
}

// โหลดข้อสอบอัตโนมัติเมื่อเปิดหน้าเว็บ
window.onload = function() {
    addKeyboardNavigation();
};
