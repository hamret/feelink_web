// 좌측 탭 및 메인 컨텐츠 전환 관련 DOM
const pageMain = document.getElementById('page-main');
const tabUpload = document.getElementById('tab-upload');
const tabCamera = document.getElementById('tab-camera');
const uploadTemplate = document.getElementById('upload-view');
const cameraTemplate = document.getElementById('camera-view');
const tabArr = [tabUpload, tabCamera];
const templateArr = [uploadTemplate, cameraTemplate];

// 결과 패널 DOM 참조 추가
const resultSidePanel = document.getElementById('result-side-panel');
const analyzeDescSide = document.getElementById('analyze-desc-side');

// 메인 뷰 변경 함수 (Upload / Camera 뷰)
function showView(idx) {
    pageMain.innerHTML = '';
    pageMain.appendChild(templateArr[idx].content.cloneNode(true));
    if (idx === 0) initUploadView();
    if (idx === 1) initCameraView();
}

// 좌측 사이드바 탭 클릭 이벤트 설정
tabArr.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
        tabArr.forEach((t, i) => {
            t.classList.toggle('nav-link-active', i === idx);
            t.setAttribute('aria-selected', String(i === idx));
        });
        showView(idx);
    });
});

// --- Upload View 초기화 ---
function initUploadView() {
    const fileInput = document.getElementById('file-input');
    const chooseBtn = document.getElementById('choose-btn');
    const uploadPreview = document.getElementById('upload-preview');
    const uploadInstructions = document.getElementById('upload-instructions');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultPanel = document.getElementById('result-panel');
    const analyzeDesc = document.getElementById('analyze-desc');

    let currFile = null;

    chooseBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) {
            uploadPreview.classList.add('hidden');
            uploadInstructions.classList.remove('hidden');
            analyzeBtn.disabled = true;
            return;
        }
        uploadPreview.src = URL.createObjectURL(file);
        uploadPreview.classList.remove('hidden');
        uploadInstructions.classList.add('hidden');
        analyzeBtn.disabled = false;
        currFile = file;
    };

    analyzeBtn.onclick = async () => {
        analyzeBtn.disabled = true;
        // 기존 패널 숨김
        resultPanel.style.display = 'none';
        // 오른쪽 패널 표시
        resultSidePanel.classList.remove('hidden');
        analyzeDescSide.textContent = 'Analyzing...';

        const fd = new FormData();
        fd.append('image', currFile, 'upload.jpg');

        try {
            const res = await fetch('/analyze', { method: 'POST', body: fd });
            const data = await res.json();

            analyzeDescSide.textContent = data.description || 'No result.';
            resultSidePanel.dataset.labels = JSON.stringify(data.labels || []);
            resultSidePanel.dataset.objects = JSON.stringify(data.objects || []);
            resultSidePanel.dataset.texts = JSON.stringify(data.texts || []);
        } catch (e) {
            analyzeDescSide.textContent = 'Analysis failed.';
        } finally {
            analyzeBtn.disabled = false;
        }
    };
}

// --- Camera View 초기화 ---
function initCameraView() {
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('capture-btn');
    const analyzeBtn = document.getElementById('analyze-cam-btn');
    const canvas = document.getElementById('canvas');
    const photoPreview = document.getElementById('photo-preview');
    const resultPanel = document.getElementById('result-panel-cam');
    const analyzeDesc = document.getElementById('analyze-desc-cam');
    const detailDesc = document.getElementById('detail-desc-cam');

    let currBlob = null;

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                video.srcObject = stream;
            })
            .catch(() => alert('Could not access webcam.'));
    }

    captureBtn.onclick = async () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        photoPreview.src = canvas.toDataURL('image/jpeg');
        photoPreview.classList.remove('hidden');
        currBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg'));
        analyzeBtn.disabled = false;
    };

    analyzeBtn.onclick = async () => {
        analyzeBtn.disabled = true;
        // 기존 패널 숨김
        resultPanel.style.display = 'none';
        // 오른쪽 패널 표시
        resultSidePanel.classList.remove('hidden');
        analyzeDescSide.textContent = 'Analyzing...';

        const fd = new FormData();
        fd.append('image', currBlob, 'camera.jpg');

        try {
            const res = await fetch('/analyze', { method: 'POST', body: fd });
            const data = await res.json();

            analyzeDescSide.textContent = data.description || 'No result.';
            resultSidePanel.dataset.labels = JSON.stringify(data.labels || []);
            resultSidePanel.dataset.objects = JSON.stringify(data.objects || []);
            resultSidePanel.dataset.texts = JSON.stringify(data.texts || []);
        } catch (e) {
            analyzeDescSide.textContent = 'Analysis failed.';
        } finally {
            analyzeBtn.disabled = false;
        }
    };
}

// 최초 화면은 Upload 뷰로 표시
showView(0);
