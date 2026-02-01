
import cv2
import numpy as np
from ultralytics import YOLO
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import os
from PIL import Image

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model
# Try to load fine-tuned model first, fallback to base model
MODEL_PATH = 'models/best.pt'
if os.path.exists(MODEL_PATH):
    print(f"Loading custom model from {MODEL_PATH}")
    yolo_model = YOLO(MODEL_PATH)
else:
    print("Custom model not found, using base yolov8n.pt (Demo mode)")
    yolo_model = YOLO('yolov8n.pt') 

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
    
    # Run YOLO detection
    results = yolo_model(img)
    
    is_sealed = False
    confidence = 0.0
    found_package = False
    label = "UNKNOWN"
    
    for r in results:
        # Custom model classes: 0: sealed, 1: unsealed
        if len(r.boxes) > 0:
            # Get the detection with highest confidence
            top_box = sorted(r.boxes, key=lambda x: float(x.conf[0]), reverse=True)[0]
            confidence = float(top_box.conf[0])
            cls = int(top_box.cls[0])
            
            # STRICTOR THRESHOLD: Require 50% confidence to consider it a "detected package"
            if confidence > 0.5:
                found_package = True
                # If using custom model (2 classes)
                if len(yolo_model.names) <= 2:
                    is_sealed = (cls == 0)
                    label = "SEALED" if is_sealed else "UNSEALED"
                else:
                    # Fallback / Demo logic for base YOLO
                    if cls in [39, 41, 45]:
                        is_sealed = confidence > 0.6
                        label = "SEALED" if is_sealed else "UNSEALED"
                    else:
                        found_package = False # Not a proxy item
            else:
                # If confidence is low, it's safer to say UNKNOWN
                found_package = False
                label = "UNKNOWN"

    if not found_package:
        label = "UNKNOWN"
        is_sealed = False
        confidence = 0.0

    # Final response
    return jsonify({
        'status': label,
        'isSealed': bool(is_sealed),
        'confidence': f"{confidence*100:.1f}%",
        'packageDetected': found_package
    })

if __name__ == '__main__':
    app.run(port=5001, debug=True)

