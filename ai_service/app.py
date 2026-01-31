
import cv2
import numpy as np
from ultralytics import YOLO
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model for package detection
# In a real scenario, you'd use a fine-tuned model: yolo_model = YOLO('models/best.pt')
yolo_model = YOLO('yolov8n.pt') 

# Load CNN model for seal classification
# seal_model = tf.keras.models.load_model('models/seal_classifier.h5')

def base64_to_image(base64_string):
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    imgdata = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(imgdata))
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    image_b64 = data.get('image')
    
    if not image_b64:
        return jsonify({'error': 'No image provided'}), 400
    
    img = base64_to_image(image_b64)
    
    # 1. Detect Package using YOLO
    results = yolo_model(img)
    
    is_sealed = True # Default
    confidence = 0.0
    
    # Mocking detection logic for demo if no fine-tuned model exists
    # If using pre-trained yolov8n, 'bottle', 'cup', 'bowl' can be proxies for food packages
    found_package = False
    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            # Proxy classes for food items in COCO
            if cls in [39, 41, 45]: # bottle, cup, bowl
                found_package = True
                confidence = conf
                
                # 2. Extract ROI and run CNN (Mocked for now)
                # x1, y1, x2, y2 = box.xyxy[0]
                # roi = img[int(y1):int(y2), int(x1):int(x2)]
                # prediction = seal_model.predict(roi)
                # is_sealed = prediction > 0.5
                
                # For demo logic:
                is_sealed = conf > 0.5 # Simplified
    
    # Randomize for demo if no real objects found
    if not found_package:
        is_sealed = np.random.random() > 0.3
        confidence = np.random.random() * 0.2 + 0.8

    return jsonify({
        'status': 'SEALED' if is_sealed else 'UNSEALED',
        'isSealed': bool(is_sealed),
        'confidence': f"{confidence*100:.1f}%",
        'packageDetected': found_package
    })

if __name__ == '__main__':
    app.run(port=5001)
