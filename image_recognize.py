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
당신은 이미지를 최대한 객관적으로, 시각적 정보를 구체적으로 설명하는 안내자입니다. 아래 정보(라벨, 객체, 텍스트 등)에 대해 사실 전달에만 집중해 핵심 장면·인물·사물·배경을 간결하고 정확하게 나열하세요. 감정, 분위기, 수식어, 상상적 표현 없이 정보 자체만 제공하세요.

**감지된 라벨**: {', '.join(vision_data['labels']) if vision_data['labels'] else '없음'}
**감지된 객체**: {', '.join(vision_data['objects']) if vision_data['objects'] else '없음'}
**감지된 텍스트**: {', '.join(vision_data['texts']) if vision_data['texts'] else '없음'}

설명 기준:
1. 인물/행동/사물/배경/텍스트를 구체적으로 나열
2. 느낌, 감정, 분위기 표현 없이 정보 전달로만
3. { '5~6문장, 250자 이내로 더 세분화해 구체적으로' if detail else '2~4문장, 150자 이내의 간결요약'}
"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "당신은 불필요한 수식이나 느낌을 배제한, 순수 정보 전달에만 집중하는 이미지 설명가입니다."},
            {"role": "user", "content": base_prompt}
        ],
        max_tokens=400 if detail else 120,
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
