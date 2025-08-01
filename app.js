// 좌측 탭 및 메인 컨텐츠 전환 관련 DOM
const pageMain = document.getElementById('page-main');
const tabUpload = document.getElementById('tab-upload');
const tabCamera = document.getElementById('tab-camera');
const uploadTemplate = document.getElementById('upload-view');
const cameraTemplate = document.getElementById('camera-view');

const tabArr = [tabUpload, tabCamera];
const templateArr = [uploadTemplate, cameraTemplate];

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
  const detailBtn = document.getElementById('detail-btn');
  const detailDesc = document.getElementById('detail-desc');
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
    resultPanel.style.display = 'block';
    analyzeDesc.textContent = 'Analyzing...';
    detailDesc.textContent = '';
    const fd = new FormData();
    fd.append('image', currFile, 'upload.jpg');
    const res = await fetch('/analyze', { method: 'POST', body: fd });
    const data = await res.json();
    analyzeDesc.textContent = data.description || 'No result.';
    resultPanel.dataset.labels = JSON.stringify(data.labels || []);
    resultPanel.dataset.objects = JSON.stringify(data.objects || []);
    resultPanel.dataset.texts = JSON.stringify(data.texts || []);
    analyzeBtn.disabled = false;
  };

  detailBtn.onclick = async () => {
    detailDesc.textContent = 'Loading details...';
    const payload = {
      labels: JSON.parse(resultPanel.dataset.labels || '[]'),
      objects: JSON.parse(resultPanel.dataset.objects || '[]'),
      texts: JSON.parse(resultPanel.dataset.texts || '[]'),
    };
    const res = await fetch('/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    detailDesc.textContent = data.detail || 'No further details.';
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
  const detailBtn = document.getElementById('detail-btn-cam');
  const detailDesc = document.getElementById('detail-desc-cam');
  let currBlob = null;

  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: true })
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
    resultPanel.style.display = 'block';
    analyzeDesc.textContent = 'Analyzing...';
    detailDesc.textContent = '';
    const fd = new FormData();
    fd.append('image', currBlob, 'camera.jpg');
    const res = await fetch('/analyze', { method: 'POST', body: fd });
    const data = await res.json();
    analyzeDesc.textContent = data.description || 'No result.';
    resultPanel.dataset.labels = JSON.stringify(data.labels || []);
    resultPanel.dataset.objects = JSON.stringify(data.objects || []);
    resultPanel.dataset.texts = JSON.stringify(data.texts || []);
    analyzeBtn.disabled = false;
  };

  detailBtn.onclick = async () => {
    detailDesc.textContent = 'Loading details...';
    const payload = {
      labels: JSON.parse(resultPanel.dataset.labels || '[]'),
      objects: JSON.parse(resultPanel.dataset.objects || '[]'),
      texts: JSON.parse(resultPanel.dataset.texts || '[]'),
    };
    const res = await fetch('/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    detailDesc.textContent = data.detail || 'No further details.';
  };
}

// --- AI Voice Chat 박스 초기화 ---

// 직접 요소를 할당
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const micBtn = document.getElementById('mic-btn');
const sendBtn = document.getElementById('chat-send-btn');
const spectrum = document.getElementById('spectrum');

initVoiceChat();

function initVoiceChat() {
  // 스펙트럼 애니메이션 제어
  function showSpectrum(on) {
    if (!spectrum) return;
    spectrum.style.display = on ? 'flex' : 'none';
    if (on) {
      if (!spectrum.dataset.anim) {
        spectrum.dataset.anim = setInterval(() => {
          spectrum.querySelectorAll('.bar').forEach((bar) => {
            bar.style.height = (9 + Math.random() * 18) + 'px';
          });
        }, 90);
      }
    } else {
      clearInterval(spectrum.dataset.anim);
      spectrum.dataset.anim = '';
      spectrum.querySelectorAll('.bar').forEach((bar) => (bar.style.height = '16px'));
    }
  }

  let recognizing = false,
    recognition;

  if ('webkitSpeechRecognition' in window) {    
    recognition = new webkitSpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      recognizing = true;
      micBtn.classList.add('bg-blue-100');
      showSpectrum(true);
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i)
        transcript += event.results[i][0].transcript;
      chatInput.value = transcript;
    };
    recognition.onend = () => {
      recognizing = false;
      micBtn.classList.remove('bg-blue-100');
      showSpectrum(false);
      if (chatInput.value.trim()) handleUser(chatInput.value.trim());
    };
  }

  micBtn.onclick = () => {
    if (!recognition) {
      alert('Your browser does not support Speech Recognition.');
      return;
    }
    if (!recognizing) recognition.start();
    else recognition.stop();
  };

  sendBtn.onclick = () => {
    if (chatInput.value.trim()) handleUser(chatInput.value.trim());
  };

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });

  async function handleUser(text) {
    // 사용자의 발화 텍스트를 채팅창에 추가
    chatHistory.innerHTML += `<div class="flex items-center gap-1"><span class="font-semibold text-blue-600">You:</span><span>${text}</span></div>`;
    chatInput.value = '';
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // "사진 찍고 분석해줘" 명령일 때 웹캠 촬영 및 분석
    if (
      /(take|capture).*(photo|picture|image).*(analyze|analysis|analyser|analyzing)/i.test(text) ||
      /사진.*(찍어|분석)/.test(text)
    ) {
      showSpectrum(true);
      await webcamAndAnalyze();
      showSpectrum(false);
      return;
    }

    // "자세히 알려줘" 명령일 때 상세 설명 요청
    if (/more (details?|explain|description)|자세히|자세하게|상세/.test(text)) {
      showSpectrum(true);
      const res = await fetch('/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      addBotMessage(data.detail);
      await playTTS(data.detail);
      showSpectrum(false);
      return;
    }

    // 일반 대화: /chat API 호출
    showSpectrum(true);
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text }),
    });
    const data = await res.json();
    addBotMessage(data.answer);
    await playTTS(data.answer);
    showSpectrum(false);
  }

  // AI 응답 메시지 추가 함수
  function addBotMessage(msg) {
    chatHistory.innerHTML += `<div class="flex items-center gap-1"><span class="font-semibold text-green-600">AI:</span><span>${msg}</span></div>`;
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // TTS 재생 함수
  async function playTTS(text) {
    const res = await fetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const blob = await res.blob();
    let audio = new Audio(URL.createObjectURL(blob));
    audio.onplay = () => showSpectrum(true);
    audio.onended = () => showSpectrum(false);
    audio.play();
  }

  // 웹캠 촬영 및 분석 요청 함수
  async function webcamAndAnalyze() {
    let video = document.createElement('video');
    video.autoplay = true;
    video.width = 400;
    video.height = 300;
    document.body.appendChild(video);
    try {
      let stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      // 1.2초 기다려 카메라 준비
      await new Promise((r) => setTimeout(r, 1200));
      let canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());
      let blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg'));
      video.remove();
      let fd = new FormData();
      fd.append('image', blob, 'voicecmd.jpg');
      let response = await fetch('/analyze', { method: 'POST', body: fd });
      let data = await response.json();
      addBotMessage(data.description);
      await playTTS(data.description);
    } catch (e) {
      addBotMessage('Could not access webcam.');
    }
  }
}

// 초기 화면은 Upload 뷰 표시
showView(0);
