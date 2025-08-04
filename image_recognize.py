import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file, send_from_directory
from google.cloud import vision
from openai import OpenAI

load_dotenv()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
app = Flask(__name__)

# ------ Vision ----------
def detect_vision_labels(image_path):
    vision_client = vision.ImageAnnotatorClient()
    with open(image_path, "rb") as image_file:
        content = image_file.read()
    image = vision.Image(content=content)
    label_response = vision_client.label_detection(image=image)
    object_response = vision_client.object_localization(image=image)
    text_response = vision_client.text_detection(image=image)
    labels = [label.description for label in label_response.label_annotations[:10]]
    objects = [obj.name for obj in object_response.localized_object_annotations[:5]]
    texts = [text.description for text in text_response.text_annotations[:3]]
    return {'labels': labels, 'objects': objects, 'texts': texts}

def create_objective_description(vision_data, detail=False):
    base_prompt = f"""
당신은 시각장애인을 위해 문제지의 내용을 자세하고 명확하게 설명하는 전문가입니다.

1) 아래는 감지된 텍스트입니다: {', '.join(vision_data['texts']) if vision_data['texts'] else '없음'}
2) 아래는 감지된 라벨과 객체입니다: 라벨 - {', '.join(vision_data['labels']) if vision_data['labels'] else '없음'}, 객체 - {', '.join(vision_data['objects']) if vision_data['objects'] else '없음'}

--- 아래의 지시를 반드시 지키세요 ---
- 모든 텍스트 내용을 빠짐없이 정확히 전달할 것
- (필요 시) 텍스트가 위치한 부분과 배치도 구체적으로 기술할 것
- 그림, 도표, 그래프 등 시각 정보를 구체적으로(위치, 크기, 색상, 모양 등) 객관적으로 해석할 것
- 텍스트와 그림을 어떻게 연결해 앞뒤 상황을 예측해 설명할것
- "관련된 주제, 실험, 등장 생물(예: 농게, 게딱지, 집게발)" 등 각각 설명할 것
- 답변은 500자 이하의 분량으로, 논리적 순서(도입-본론-결론)로 작성할 것
- 감정, 평가, 추측 없이 간결하고 정확하게 전달할것.
- 어떤 태그가 나왔는지 절대 출력하지 말 것.

설명:
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "친절하고 상세한 설명가 역할을 수행해 주세요."},
            {"role": "user", "content": base_prompt}
        ],
        max_tokens=600,
        temperature=0.6
    )
    return response.choices[0].message.content.strip()


def text_to_speech_description(text):
    # OpenAI TTS (alloy는 언어 구분 없음, but 한글 텍스트 잘 읽음)
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",  # OpenAI가 제공하는 voice 기본값
        input=text
    )
    response.stream_to_file("description.mp3")

# ----------- API Routes -----------

@app.route('/analyze', methods=['POST'])
def analyze_image():
    file = request.files['image']
    filepath = 'uploaded.jpg'
    file.save(filepath)
    vision_data = detect_vision_labels(filepath)
    description = create_objective_description(vision_data, detail=False)
    try:
        os.remove(filepath)
    except: pass
    return jsonify({
        'labels': vision_data['labels'],
        'objects': vision_data['objects'],
        'texts': vision_data['texts'],
        'description': description
    })

@app.route('/detail', methods=['POST'])
def detail_explanation():
    data = request.get_json()
    vision_data = {
        'labels': data.get('labels', []),
        'objects': data.get('objects', []),
        'texts': data.get('texts', [])
    }
    detail = create_objective_description(vision_data, detail=True)
    return jsonify({'detail': detail})

@app.route('/tts', methods=['POST'])
def tts():
    text = request.json.get('text')
    text_to_speech_description(text)
    return send_file('description.mp3', mimetype="audio/mpeg")

@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.json.get('question')
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "당신은 친절하고 유창한 한국어 AI 도우미입니다."},
            {"role": "user", "content": user_input}
        ],
        max_tokens=600,
        temperature=0.6
    )
    return jsonify({'answer': response.choices[0].message.content.strip()})

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
